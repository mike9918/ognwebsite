import { content } from "./content";
import { exportCsv } from "./csv";
import { beginDiscord, discordEnabled, discordErrorMessage, finishDiscord } from "./discord";
import {
  canonicalOrigin,
  cleanText,
  clientCountry,
  clientIp,
  secretsMatch,
  securityHeaders,
  wantsJson,
} from "./http";
import {
  homePage,
  notFoundPage,
  textPage,
  wishlistPage,
  type FormValues,
  type WishlistView,
} from "./html";
import {
  createSignup,
  findByRef,
  normalizeEmail,
  normalizeRef,
  normalizeRunType,
  toPublic,
} from "./signup";
import { verifyTurnstile } from "./turnstile";

type Failure = "validation" | "turnstile" | "rate";

function emptyValues(ref: string): FormValues {
  return {
    email: "",
    discordUsername: "",
    runType: "",
    runDetail: "",
    ref,
  };
}

function valuesFromForm(form: FormData, refFallback: string): FormValues {
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  return {
    email: cleanText(read("email"), 254),
    discordUsername: cleanText(read("discord_username"), 32),
    runType: cleanText(read("run_type"), 16),
    runDetail: cleanText(read("run_detail"), 120),
    ref: normalizeRef(read("ref")) ?? normalizeRef(refFallback) ?? "",
  };
}

function failureMessage(failure: Failure, detail?: "email" | "run"): string {
  if (failure === "turnstile") return content.errors.turnstile;
  if (failure === "rate") return content.errors.rate;
  if (detail === "email") return content.errors.email;
  if (detail === "run") return content.errors.runType;
  return content.errors.validation;
}

function htmlResponse(body: string, status: number, method: string, cookies: string[] = []): Response {
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(method === "HEAD" ? null : body, { status, headers });
}

function jsonResponse(body: unknown, status: number, cookies: string[] = []): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location: string, status: number, cookies: string[] = []): Response {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status, headers });
}

function assetResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders())) headers.set(name, value);
  if (!headers.has("Cache-Control")) headers.set("Cache-Control", "public, max-age=86400");
  return new Response(response.body, { status: response.status, headers });
}

function inviteUrl(env: Env): string | null {
  if (!env.DISCORD_INVITE_URL) return null;
  try {
    const url = new URL(env.DISCORD_INVITE_URL);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function renderWishlist(
  request: Request,
  env: Env,
  view: WishlistView,
  status: number,
  cookies: string[] = [],
): Promise<Response> {
  return htmlResponse(wishlistPage(view), status, request.method, cookies);
}

async function handleSignup(request: Request, env: Env): Promise<Response> {
  const length = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(length) && length > 20_000) {
    return jsonResponse({ ok: false, error: "validation", message: content.errors.validation }, 400);
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: "validation", message: content.errors.validation }, 400);
  }

  const json = wantsJson(request);
  const values = valuesFromForm(form, "");
  const baseView = (): WishlistView => ({
    discordEnabled: discordEnabled(env),
    siteKey: env.TURNSTILE_SITE_KEY,
    values,
    error: null,
    success: null,
  });

  const fail = (failure: Failure, status: number, detail?: "email" | "run", cookies: string[] = []) => {
    const message = failureMessage(failure, detail);
    if (json) return jsonResponse({ ok: false, error: failure, message }, status, cookies);
    return renderWishlist(request, env, { ...baseView(), error: message }, status, cookies);
  };

  const runType = normalizeRunType(values.runType);
  if (!runType) return fail("validation", 400, "run");
  const email = normalizeEmail(values.email);
  if (!email) return fail("validation", 400, "email");

  const token = form.get("cf-turnstile-response");
  const turnstileToken = typeof token === "string" ? token : "";
  if (!(await verifyTurnstile(request, env, turnstileToken))) return fail("turnstile", 403);

  if (!env.IP_HASH_SALT) {
    console.error(JSON.stringify({ event: "missing_ip_salt" }));
    return fail("validation", 500);
  }

  const created = await createSignup(env.DB, {
    email,
    discordId: null,
    discordUsername: values.discordUsername || null,
    runType,
    runDetail: values.runDetail || null,
    ref: values.ref ? normalizeRef(values.ref) : null,
    ip: clientIp(request),
    country: clientCountry(request),
    salt: env.IP_HASH_SALT,
    now: new Date(),
  });
  if (!created.ok) return fail("rate", 429);

  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const entry = await toPublic(env.DB, created.row, origin, created.existing);
  console.log(
    JSON.stringify({
      event: "waitlist_signup",
      existing: created.existing,
      country: clientCountry(request),
      via: "email",
    }),
  );
  const discordInviteUrl = inviteUrl(env);
  if (json) {
    return jsonResponse({ ok: true, ...entry, discordInviteUrl }, 200);
  }
  return redirect(`/wishlist?welcome=${entry.refCode}`, 303);
}

async function handleDiscordStart(request: Request, env: Env): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/wishlist?error=validation", 303);
  }
  const read = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value : "";
  };
  const token = form.get("cf-turnstile-response");
  const result = await beginDiscord(request, env, {
    runType: read("run_type"),
    runDetail: cleanText(read("run_detail"), 120),
    ref: read("ref"),
    token: typeof token === "string" ? token : "",
  });
  if ("error" in result) {
    return redirect(`/wishlist?error=${result.error}`, 303);
  }
  return redirect(result.location, 302, result.cookies);
}

async function handleDiscordCallback(request: Request, env: Env): Promise<Response> {
  const result = await finishDiscord(request, env);
  if ("error" in result) {
    return redirect(`/wishlist?error=${result.error}`, 303, result.cookies);
  }
  return redirect(`/wishlist?welcome=${result.entry.refCode}`, 303, result.cookies);
}

async function handleExport(request: Request, env: Env): Promise<Response> {
  const header = request.headers.get("Authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!env.ADMIN_TOKEN || !(await secretsMatch(provided, env.ADMIN_TOKEN))) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store", "WWW-Authenticate": "Bearer", ...securityHeaders() },
    });
  }
  const csv = await exportCsv(env.DB);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="waitlist.csv"',
      "Cache-Control": "no-store",
      ...securityHeaders(),
    },
  });
}

function knownError(code: string): string | null {
  if (code === "validation" || code === "turnstile") return failureMessage(code);
  if (code === "rate") return content.errors.rate;
  if (code === "discord" || code === "discord_email") return discordErrorMessage(code);
  return null;
}

async function wishlistGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const welcome = normalizeRef(url.searchParams.get("welcome") ?? "");
  const ref = normalizeRef(url.searchParams.get("ref") ?? "") ?? "";
  const errorCode = url.searchParams.get("error") ?? "";
  const error = knownError(errorCode);
  if (welcome) {
    const row = await findByRef(env.DB, welcome);
    if (row) {
      const entry = await toPublic(
        env.DB,
        row,
        canonicalOrigin(request, env.PUBLIC_ORIGIN),
        false,
      );
      return renderWishlist(request, env, {
        discordEnabled: false,
        siteKey: "",
        values: emptyValues(""),
        error: null,
        success: { ...entry, discordInviteUrl: inviteUrl(env) },
      }, 200);
    }
  }
  return renderWishlist(request, env, {
    discordEnabled: discordEnabled(env),
    siteKey: env.TURNSTILE_SITE_KEY,
    values: emptyValues(ref),
    error,
    success: null,
  }, 200);
}

function isAssetPath(pathname: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

export default {
  async fetch(request, env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.hostname === "www.opengamenode.com") {
        url.hostname = "opengamenode.com";
        url.protocol = "https:";
        return redirect(url.toString(), 301);
      }

      const method = request.method;
      if (method !== "GET" && method !== "HEAD" && method !== "POST") {
        return new Response("Method not allowed", { status: 405, headers: securityHeaders() });
      }

      if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
        url.pathname = url.pathname.replace(/\/+$/, "");
        return redirect(`${url.pathname}${url.search}`, 301);
      }

      if (method === "GET" && url.pathname === "/" && url.searchParams.has("ref")) {
        url.pathname = "/wishlist";
        return redirect(`${url.pathname}${url.search}`, 302);
      }

      if (method === "POST" && url.pathname === "/api/waitlist") return handleSignup(request, env);
      if (method === "POST" && url.pathname === "/api/auth/discord") return handleDiscordStart(request, env);
      if (method === "GET" && url.pathname === "/api/auth/discord/callback") {
        return handleDiscordCallback(request, env);
      }
      if (method === "GET" && url.pathname === "/api/admin/export.csv") return handleExport(request, env);

      if (method === "GET" || method === "HEAD") {
        if (url.pathname === "/") return htmlResponse(homePage(), 200, method);
        if (url.pathname === "/wishlist") return wishlistGet(request, env);
        if (url.pathname === "/terms") return htmlResponse(textPage(content.terms.title, content.terms.body), 200, method);
        if (url.pathname === "/privacy") {
          return htmlResponse(textPage(content.privacy.title, content.privacy.body), 200, method);
        }
      }

      if ((method === "GET" || method === "HEAD") && isAssetPath(url.pathname)) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return assetResponse(asset);
      }

      return htmlResponse(notFoundPage(), 404, method);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "unhandled",
          message: error instanceof Error ? error.message : "error",
        }),
      );
      return htmlResponse(textPage(content.name, content.errors.generic), 500, request.method);
    }
  },
} satisfies ExportedHandler<Env>;
