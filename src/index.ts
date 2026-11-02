import {
  adminConfigured,
  adminDashboardPage,
  adminLoginPage,
  beginAdminDiscord,
  clearAdminSession,
  finishAdminDiscord,
  listSubmissions,
  parseSettingsForm,
  readAdminSession,
  getSettings,
  updateSettings,
} from "./admin";
import { content } from "./content";
import { exportCsv } from "./csv";
import { beginDiscord, discordConfigured, discordErrorMessage, finishDiscord } from "./discord";
import {
  canonicalOrigin,
  cleanText,
  isSecure,
  secretsMatch,
  securityHeaders,
} from "./http";
import {
  homePage,
  notFoundPage,
  textPage,
  wishlistPage,
  type FormValues,
  type WishlistView,
} from "./html";
import { findByRef, normalizeRef, toPublic } from "./signup";
import { signupBlockedReason } from "./settings";

function emptyValues(ref: string): FormValues {
  return {
    runType: "",
    runDetail: "",
    ref,
  };
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
  view: WishlistView,
  status: number,
  cookies: string[] = [],
): Promise<Response> {
  return htmlResponse(wishlistPage(view), status, request.method, cookies);
}

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("Accept") ?? "";
  return accept.includes("application/json");
}

function jsonResponse(
  body: unknown,
  status: number,
  cookies: string[] = [],
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...securityHeaders(),
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

async function handleDiscordStart(request: Request, env: Env): Promise<Response> {
  const asJson = wantsJson(request);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    if (asJson) return jsonResponse({ error: "validation" }, 400);
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
    if (asJson) return jsonResponse({ error: result.error }, 400);
    return redirect(`/wishlist?error=${result.error}`, 303);
  }
  // Prefer JSON for the waitlist script so navigation to Discord is a top-level
  // assign, not a form 302 (which Chrome can block via form-action).
  if (asJson) return jsonResponse({ location: result.location }, 200, result.cookies);
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
  const session = await readAdminSession(request, env);
  const bearerOk = Boolean(env.ADMIN_TOKEN && (await secretsMatch(provided, env.ADMIN_TOKEN)));
  if (!session && !bearerOk) {
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

function knownWishlistError(code: string): string | null {
  if (
    code === "validation" ||
    code === "turnstile" ||
    code === "rate" ||
    code === "discord" ||
    code === "discord_email" ||
    code === "discord_new" ||
    code === "closed" ||
    code === "full"
  ) {
    return discordErrorMessage(code);
  }
  return null;
}

async function wishlistGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const welcome = normalizeRef(url.searchParams.get("welcome") ?? "");
  const ref = normalizeRef(url.searchParams.get("ref") ?? "") ?? "";
  const errorCode = url.searchParams.get("error") ?? "";
  const error = knownWishlistError(errorCode);
  const blocked = await signupBlockedReason(env.DB);
  if (welcome) {
    const row = await findByRef(env.DB, welcome);
    if (row) {
      const entry = await toPublic(
        env.DB,
        row,
        canonicalOrigin(request, env.PUBLIC_ORIGIN),
        false,
      );
      return renderWishlist(request, {
        discordEnabled: false,
        accepting: true,
        siteKey: "",
        values: emptyValues(""),
        error: null,
        success: { ...entry, discordInviteUrl: inviteUrl(env) },
      }, 200);
    }
  }
  return renderWishlist(request, {
    discordEnabled: discordConfigured(env),
    accepting: blocked === null,
    siteKey: env.TURNSTILE_SITE_KEY,
    values: emptyValues(ref),
    error: error ?? (blocked === "closed" ? content.errors.closed : blocked === "full" ? content.errors.full : null),
    success: null,
  }, 200);
}

async function adminGet(request: Request, env: Env): Promise<Response> {
  if (!adminConfigured(env)) {
    return htmlResponse(adminLoginPage(content.admin.unavailable), 503, request.method);
  }
  const session = await readAdminSession(request, env);
  const url = new URL(request.url);
  const errorCode = url.searchParams.get("error") ?? "";
  if (!session) {
    const error =
      errorCode === "forbidden"
        ? content.admin.forbidden
        : errorCode === "discord"
          ? content.admin.discordFailed
          : null;
    return htmlResponse(adminLoginPage(error), 200, request.method);
  }
  const page = Number(url.searchParams.get("page") ?? "1");
  const [settings, list] = await Promise.all([getSettings(env.DB), listSubmissions(env.DB, page)]);
  const notice = url.searchParams.get("saved") === "1" ? content.admin.saved : null;
  const error = url.searchParams.get("settings") === "invalid" ? "Check the settings and try again." : null;
  return htmlResponse(
    adminDashboardPage({ session, settings, list, notice, error }),
    200,
    request.method,
  );
}

async function handleAdminSettings(request: Request, env: Env): Promise<Response> {
  const session = await readAdminSession(request, env);
  if (!session) return redirect("/admin?error=forbidden", 303);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect("/admin?settings=invalid", 303);
  }
  const parsed = await parseSettingsForm(form);
  if (!parsed.ok) return redirect("/admin?settings=invalid", 303);
  await updateSettings(env.DB, {
    isOpen: parsed.isOpen,
    signupCap: parsed.signupCap,
    now: new Date(),
  });
  return redirect("/admin?saved=1", 303);
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

      if (method === "POST" && url.pathname === "/api/auth/discord") return handleDiscordStart(request, env);
      if (method === "GET" && url.pathname === "/api/auth/discord/callback") {
        return handleDiscordCallback(request, env);
      }
      if (method === "GET" && url.pathname === "/api/auth/admin/discord") {
        const result = await beginAdminDiscord(request, env);
        if ("error" in result) return redirect("/admin?error=discord", 303);
        return redirect(result.location, 302, result.cookies);
      }
      if (method === "GET" && url.pathname === "/api/auth/admin/discord/callback") {
        const result = await finishAdminDiscord(request, env);
        if ("error" in result) {
          return redirect(`/admin?error=${result.error}`, 303, result.cookies);
        }
        return redirect("/admin", 303, result.cookies);
      }
      if (method === "POST" && url.pathname === "/api/admin/logout") {
        return redirect("/admin", 303, clearAdminSession(isSecure(request)));
      }
      if (method === "POST" && url.pathname === "/api/admin/settings") {
        return handleAdminSettings(request, env);
      }
      if (method === "GET" && url.pathname === "/api/admin/export.csv") return handleExport(request, env);
      if (method === "POST" && url.pathname === "/api/waitlist") {
        return new Response("Gone", { status: 410, headers: securityHeaders() });
      }

      if (method === "GET" || method === "HEAD") {
        if (url.pathname === "/") return htmlResponse(homePage(), 200, method);
        if (url.pathname === "/wishlist") return wishlistGet(request, env);
        if (url.pathname === "/admin") return adminGet(request, env);
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
