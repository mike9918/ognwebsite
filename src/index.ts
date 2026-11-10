import {
  adminConfigured,
  adminDashboardPage,
  adminLoginPage,
  beginAdminDiscord,
  clearAdminSession,
  deleteSubmission,
  finishAdminDiscord,
  listSubmissions,
  parseEntryId,
  parseSettingsForm,
  readAdminSession,
  getSettings,
  updateSettings,
} from "./admin";
import { content } from "./content";
import { exportCsv } from "./csv";
import { beginDiscord, discordConfigured, discordErrorMessage, finishDiscord, readPendingSignup } from "./discord";
import {
  canonicalOrigin,
  cleanText,
  isSecure,
  relaxFramingForPreview,
  secretsMatch,
  securityHeaders,
} from "./http";
import {
  faqPage,
  guidePage,
  helpIndexPage,
  homePage,
  legalPage,
  notFoundPage,
  supporterPage,
  textPage,
  wishlistPage,
  type Capacity,
  type FormValues,
  type WishlistView,
} from "./html";
import { findByRef, normalizeRef, toPublic } from "./signup";
import { signupBlockedReason } from "./settings";
import { findGuide } from "./guides";
import { aupBody, privacyBody, termsBody } from "./legal";
import { provisionConfig, provisionEntry, provisioningConfigured } from "./provision";
import { sweepSignups } from "./sweep";

function emptyValues(): FormValues {
  return {
    runType: "",
    runDetail: "",
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
  env: Env,
  view: WishlistView,
  status: number,
  cookies: string[] = [],
): Promise<Response> {
  return htmlResponse(wishlistPage(view, inviteUrl(env)), status, request.method, cookies);
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
    token: typeof token === "string" ? token : "",
  });
  if ("error" in result) {
    if (asJson) return jsonResponse({ error: result.error }, 400);
    return redirect(`/wishlist?error=${result.error}`, 303);
  }
  // Prefer JSON for the sign-up script so navigation to Discord is a top-level
  // assign, not a form 302 (which Chrome can block via form-action).
  if (asJson) return jsonResponse({ location: result.location }, 200, result.cookies);
  return redirect(result.location, 302, result.cookies);
}

async function handleDiscordCallback(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const result = await finishDiscord(request, env, ctx);
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
      "Content-Disposition": 'attachment; filename="signups.csv"',
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
    code === "discord_join" ||
    code === "discord_conflict" ||
    code === "closed" ||
    code === "full"
  ) {
    return discordErrorMessage(code);
  }
  return null;
}

async function homeGet(request: Request, env: Env): Promise<Response> {
  const draft = await readPendingSignup(request, env);
  const [blocked, settings] = await Promise.all([
    signupBlockedReason(env.DB),
    getSettings(env.DB),
  ]);
  const view: WishlistView = {
    discordEnabled: discordConfigured(env),
    capacity: (blocked ?? "open") as Capacity,
    autoProvision: settings.autoProvision,
    siteKey: env.TURNSTILE_SITE_KEY,
    values: draft ? { runType: draft.runType, runDetail: draft.runDetail } : emptyValues(),
    error: null,
    success: null,
  };
  return htmlResponse(homePage(view, inviteUrl(env)), 200, request.method);
}

async function wishlistGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const welcome = normalizeRef(url.searchParams.get("welcome") ?? "");
  const errorCode = url.searchParams.get("error") ?? "";
  const error = knownWishlistError(errorCode);
  const draft = await readPendingSignup(request, env);
  const [blocked, settings] = await Promise.all([
    signupBlockedReason(env.DB),
    getSettings(env.DB),
  ]);
  if (welcome) {
    const row = await findByRef(env.DB, welcome);
    if (row) {
      return renderWishlist(request, env, {
        discordEnabled: false,
        capacity: "open",
        autoProvision: settings.autoProvision,
        siteKey: "",
        values: emptyValues(),
        error: null,
        success: { ...toPublic(row, false), discordInviteUrl: inviteUrl(env) },
      }, 200);
    }
  }
  return renderWishlist(request, env, {
    discordEnabled: discordConfigured(env),
    capacity: (blocked ?? "open") as Capacity,
    autoProvision: settings.autoProvision,
    siteKey: env.TURNSTILE_SITE_KEY,
    values: draft ? { runType: draft.runType, runDetail: draft.runDetail } : emptyValues(),
    error,
    success: null,
  }, 200);
}

async function adminGet(request: Request, env: Env): Promise<Response> {
  if (!adminConfigured(env)) {
    // Look like a missing page rather than an admin outage.
    return htmlResponse(adminLoginPage(null), 404, request.method);
  }
  const session = await readAdminSession(request, env);
  const url = new URL(request.url);
  if (!session) {
    // Obscure the admin entrypoint: same body + status as a public 404.
    // Sign-in remains at /api/auth/admin/discord.
    return htmlResponse(adminLoginPage(null), 404, request.method);
  }
  const page = Number(url.searchParams.get("page") ?? "1");
  const [settings, list] = await Promise.all([getSettings(env.DB), listSubmissions(env.DB, page)]);
  const provisionParam = url.searchParams.get("provision") ?? "";
  const notice =
    url.searchParams.get("saved") === "1"
      ? content.admin.saved
      : url.searchParams.get("deleted") === "1"
        ? content.admin.deleted
        : url.searchParams.get("provisioned") === "1"
          ? content.admin.provisioned
          : null;
  const error =
    url.searchParams.get("settings") === "invalid"
      ? "Check the settings and try again."
      : url.searchParams.get("deleted") === "missing"
        ? content.admin.deleteMissing
        : provisionParam === "failed"
          ? content.admin.provisionFailed
          : provisionParam === "busy"
            ? content.admin.provisionBusy
            : provisionParam === "unavailable"
              ? content.admin.provisionUnavailable
              : null;
  return htmlResponse(
    adminDashboardPage({
      session,
      settings,
      list,
      notice,
      error,
      panelUrl: provisionConfig(env)?.panelUrl ?? content.panelUrl,
      provisioningEnabled: provisioningConfigured(env),
    }),
    200,
    request.method,
  );
}

function adminRedirect(params: Record<string, string>, pageRaw: unknown = null): Response {
  const search = new URLSearchParams(params);
  if (typeof pageRaw === "string" && /^\d+$/.test(pageRaw) && Number(pageRaw) > 1) {
    search.set("page", pageRaw);
  }
  const query = search.toString();
  return redirect(query ? `/admin?${query}` : "/admin", 303);
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
    autoProvision: parsed.autoProvision,
    now: new Date(),
  });
  return redirect("/admin?saved=1", 303);
}

async function handleAdminProvision(request: Request, env: Env): Promise<Response> {
  const session = await readAdminSession(request, env);
  if (!session) return redirect("/admin?error=forbidden", 303);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return adminRedirect({ provision: "missing" });
  }
  const id = parseEntryId(form.get("id"));
  const pageRaw = form.get("page");
  if (id === null) return adminRedirect({ provision: "missing" }, pageRaw);
  const outcome = await provisionEntry(env, id);
  if (outcome.state === "missing") return adminRedirect({ deleted: "missing" }, pageRaw);
  if (outcome.state === "busy") return adminRedirect({ provision: "busy" }, pageRaw);
  if (outcome.state === "unconfigured") return adminRedirect({ provision: "unavailable" }, pageRaw);
  if (outcome.state === "failed") return adminRedirect({ provision: "failed" }, pageRaw);
  return adminRedirect({ provisioned: "1" }, pageRaw);
}

async function handleAdminDelete(request: Request, env: Env): Promise<Response> {
  const session = await readAdminSession(request, env);
  if (!session) return redirect("/admin?error=forbidden", 303);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return adminRedirect({ deleted: "missing" });
  }
  const id = parseEntryId(form.get("id"));
  const pageRaw = form.get("page");
  if (id === null) return adminRedirect({ deleted: "missing" }, pageRaw);
  const result = await deleteSubmission(env.DB, id);
  if (result === "missing") return adminRedirect({ deleted: "missing" }, pageRaw);
  return adminRedirect({ deleted: "1" }, pageRaw);
}

function isAssetPath(pathname: string): boolean {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

      if (method === "POST" && url.pathname === "/api/auth/discord") return handleDiscordStart(request, env);
      if (method === "GET" && url.pathname === "/api/auth/discord/callback") {
        return handleDiscordCallback(request, env, ctx);
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
      if (method === "POST" && url.pathname === "/api/admin/entries/delete") {
        return handleAdminDelete(request, env);
      }
      if (method === "POST" && url.pathname === "/api/admin/entries/provision") {
        return handleAdminProvision(request, env);
      }
      if (method === "GET" && url.pathname === "/api/admin/export.csv") return handleExport(request, env);
      // Public capacity flag: a boolean only. The cap value never leaves the
      // admin page, so no public surface can derive how many spots exist.
      if (method === "GET" && url.pathname === "/api/capacity") {
        const blocked = await signupBlockedReason(env.DB);
        return jsonResponse({ accepting: blocked === null }, 200);
      }
      if (method === "POST" && url.pathname === "/api/waitlist") {
        return new Response("Gone", { status: 410, headers: securityHeaders() });
      }

      if (method === "GET" || method === "HEAD") {
        if (url.pathname === "/") return homeGet(request, env);
        // /signup is the public link; /wishlist stays for the OAuth callback.
        if (url.pathname === "/wishlist" || url.pathname === "/signup") {
          return wishlistGet(request, env);
        }
        if (url.pathname === "/faq") return htmlResponse(faqPage(inviteUrl(env)), 200, method);
        if (url.pathname === "/supporter") {
          return htmlResponse(supporterPage(inviteUrl(env)), 200, method);
        }
        if (url.pathname === "/help") {
          return htmlResponse(helpIndexPage(inviteUrl(env)), 200, method);
        }
        if (url.pathname.startsWith("/help/")) {
          const guide = findGuide(url.pathname.slice("/help/".length));
          if (guide) return htmlResponse(guidePage(guide, inviteUrl(env)), 200, method);
        }
        if (url.pathname === "/admin") return adminGet(request, env);
        if (url.pathname === "/terms") {
          return htmlResponse(
            legalPage({ title: content.legal.terms, body: termsBody, path: "/terms" }, inviteUrl(env)),
            200,
            method,
          );
        }
        if (url.pathname === "/privacy") {
          return htmlResponse(
            legalPage({ title: content.legal.privacy, body: privacyBody, path: "/privacy" }, inviteUrl(env)),
            200,
            method,
          );
        }
        if (url.pathname === "/aup") {
          return htmlResponse(
            legalPage({ title: content.legal.aup, body: aupBody, path: "/aup" }, inviteUrl(env)),
            200,
            method,
          );
        }
      }

      if ((method === "GET" || method === "HEAD") && isAssetPath(url.pathname)) {
        const asset = await env.ASSETS.fetch(request);
        if (asset.status !== 404) return assetResponse(asset);
      }

      return htmlResponse(notFoundPage(inviteUrl(env)), 404, method);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "unhandled",
          message: error instanceof Error ? error.message : "error",
        }),
      );
      return htmlResponse(
        textPage(content.name, content.errors.generic, inviteUrl(env)),
        500,
        request.method,
      );
    }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // Framing is relaxed for local/preview hosts so the Browser panel can embed
    // the page; production keeps X-Frame-Options: DENY.
    return relaxFramingForPreview(request, await route(request, env, ctx));
  },
  // Safety net for sign-ups whose inline provisioning did not finish: a slow
  // panel, a crash, or a failed attempt that is still under the attempt cap.
  async scheduled(_controller, env, ctx): Promise<void> {
    ctx.waitUntil(sweepSignups(env));
  },
} satisfies ExportedHandler<Env>;
