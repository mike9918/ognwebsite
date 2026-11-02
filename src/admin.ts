import { content } from "./content";
import {
  canonicalOrigin,
  clearCookie,
  escapeHtml,
  isSecure,
  readCookie,
  secretsMatch,
  setCookie,
} from "./http";
import { getSettings, updateSettings, type WaitlistSettings } from "./settings";
import { randomToken, signPayload, unsignPayload } from "./signed";
import type { WaitlistRow } from "./signup";

const ADMIN_STATE_COOKIE = "ogn_admin_oauth";
const ADMIN_SESSION_COOKIE = "ogn_admin_session";
const STATE_MAX_AGE = 10 * 60;
const SESSION_MAX_AGE = 12 * 60 * 60;
const PAGE_SIZE = 50;

type AdminSession = {
  discordId: string;
  username: string;
  exp: number;
};

export function parseAdminIds(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((value) => value.trim())
      .filter((value) => /^\d{5,30}$/.test(value)),
  );
}

export function adminConfigured(env: Env): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && parseAdminIds(env.ADMIN_DISCORD_IDS).size);
}

function sessionSecret(env: Env): string {
  return env.DISCORD_CLIENT_SECRET;
}

export async function readAdminSession(request: Request, env: Env): Promise<AdminSession | null> {
  const token = readCookie(request, ADMIN_SESSION_COOKIE);
  if (!token) return null;
  const payload = await unsignPayload(token, sessionSecret(env));
  if (!payload) return null;
  try {
    const session = JSON.parse(payload) as AdminSession;
    if (!session.discordId || !session.exp || session.exp < Date.now()) return null;
    if (!parseAdminIds(env.ADMIN_DISCORD_IDS).has(session.discordId)) return null;
    return session;
  } catch {
    return null;
  }
}

export function clearAdminSession(secure: boolean): string[] {
  return [clearCookie(ADMIN_STATE_COOKIE, secure), clearCookie(ADMIN_SESSION_COOKIE, secure)];
}

export async function beginAdminDiscord(
  request: Request,
  env: Env,
): Promise<{ location: string; cookies: string[] } | { error: "unavailable" }> {
  if (!adminConfigured(env)) return { error: "unavailable" };
  const state = randomToken(32);
  const secure = isSecure(request);
  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/admin/discord/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");
  return {
    location: authorize.toString(),
    cookies: [setCookie(ADMIN_STATE_COOKIE, state, { maxAge: STATE_MAX_AGE, secure })],
  };
}

export async function finishAdminDiscord(
  request: Request,
  env: Env,
): Promise<{ cookies: string[] } | { error: "discord" | "forbidden"; cookies: string[] }> {
  const secure = isSecure(request);
  const cleared = [clearCookie(ADMIN_STATE_COOKIE, secure)];
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = readCookie(request, ADMIN_STATE_COOKIE) ?? "";
  if (!code || !state || !(await secretsMatch(state, stateCookie))) {
    return { error: "discord", cookies: cleared };
  }

  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/admin/discord/callback`;
  try {
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenResponse.ok) return { error: "discord", cookies: cleared };
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token ?? "";
    if (!accessToken) return { error: "discord", cookies: cleared };
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) return { error: "discord", cookies: cleared };
    const user = (await userResponse.json()) as { id?: string; username?: string };
    if (!user.id || !parseAdminIds(env.ADMIN_DISCORD_IDS).has(user.id)) {
      return { error: "forbidden", cookies: cleared };
    }
    const session: AdminSession = {
      discordId: user.id,
      username: user.username ?? "admin",
      exp: Date.now() + SESSION_MAX_AGE * 1000,
    };
    return {
      cookies: [
        ...cleared,
        setCookie(ADMIN_SESSION_COOKIE, await signPayload(JSON.stringify(session), sessionSecret(env)), {
          maxAge: SESSION_MAX_AGE,
          secure,
        }),
      ],
    };
  } catch {
    return { error: "discord", cookies: cleared };
  }
}

export async function listSubmissions(
  db: D1Database,
  page: number,
): Promise<{ rows: WaitlistRow[]; total: number; page: number; pageSize: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const offset = (safePage - 1) * PAGE_SIZE;
  const [countRow, { results }] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS n FROM waitlist").first<{ n: number }>(),
    db
      .prepare(
        `SELECT id, email, discord_id, discord_username, run_type, run_detail, ref_code, referred_by,
                referral_count, ip_hash, country, created_at, invited_at, wave
         FROM waitlist
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(PAGE_SIZE, offset)
      .all<WaitlistRow>(),
  ]);
  return {
    rows: results,
    total: countRow?.n ?? 0,
    page: safePage,
    pageSize: PAGE_SIZE,
  };
}

function adminLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)} · ${escapeHtml(content.name)}</title>
  <meta name="robots" content="noindex,nofollow">
  <meta name="theme-color" content="#0d1712">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <header class="site-header">
    <div class="frame header-inner">
      <a class="brand" href="/admin">
        <img src="/brand/opengamenode-dark-960.png" width="960" height="320" alt="OpenGameNode">
      </a>
      <nav aria-label="Admin">
        <a href="/">Site</a>
      </nav>
    </div>
  </header>
  <main id="content"><div class="frame stack admin">${body}</div></main>
</body>
</html>`;
}

export function adminLoginPage(error: string | null): string {
  const alert = error ? `<p class="alert" role="alert">${escapeHtml(error)}</p>` : "";
  return adminLayout(
    "Admin",
    `<section class="card">
      <h1>Waitlist admin</h1>
      <p class="supporting">Sign in with the Discord account listed in ADMIN_DISCORD_IDS.</p>
      ${alert}
      <p><a class="button" href="/api/auth/admin/discord">Continue with Discord</a></p>
    </section>`,
  );
}

export function adminDashboardPage(options: {
  session: AdminSession;
  settings: WaitlistSettings;
  list: { rows: WaitlistRow[]; total: number; page: number; pageSize: number };
  notice: string | null;
  error: string | null;
}): string {
  const notice = options.notice ? `<p class="notice" role="status">${escapeHtml(options.notice)}</p>` : "";
  const error = options.error ? `<p class="alert" role="alert">${escapeHtml(options.error)}</p>` : "";
  const capValue = options.settings.signupCap === null ? "" : String(options.settings.signupCap);
  const totalPages = Math.max(1, Math.ceil(options.list.total / options.list.pageSize));
  const prev =
    options.list.page > 1
      ? `<a class="button button-secondary" href="/admin?page=${options.list.page - 1}">Previous</a>`
      : "";
  const next =
    options.list.page < totalPages
      ? `<a class="button button-secondary" href="/admin?page=${options.list.page + 1}">Next</a>`
      : "";
  const rows = options.list.rows
    .map(
      (row) => `<tr>
      <td>${row.id}</td>
      <td>${escapeHtml(row.email)}</td>
      <td>${escapeHtml(row.discord_username ?? "")}<div class="muted">${escapeHtml(row.discord_id ?? "")}</div></td>
      <td>${escapeHtml(row.run_type)}${row.run_detail ? `<div class="muted">${escapeHtml(row.run_detail)}</div>` : ""}</td>
      <td>${escapeHtml(row.ref_code)}</td>
      <td>${row.referral_count}</td>
      <td>${escapeHtml(row.country ?? "")}</td>
      <td>${escapeHtml(row.created_at)}</td>
    </tr>`,
    )
    .join("");

  return adminLayout(
    "Admin",
    `<div class="admin-bar">
      <p>Signed in as <strong>${escapeHtml(options.session.username)}</strong></p>
      <form method="post" action="/api/admin/logout"><button class="button button-secondary" type="submit">Sign out</button></form>
    </div>
    ${notice}${error}
    <section class="card" aria-labelledby="settings-heading">
      <h1 id="settings-heading">Waitlist controls</h1>
      <p class="note">${options.list.total} sign-up${options.list.total === 1 ? "" : "s"} stored.</p>
      <form method="post" action="/api/admin/settings" class="admin-settings">
        <fieldset>
          <legend>Status</legend>
          <label class="choice"><input type="radio" name="is_open" value="1"${options.settings.isOpen ? " checked" : ""}> <span>Open</span></label>
          <label class="choice"><input type="radio" name="is_open" value="0"${options.settings.isOpen ? "" : " checked"}> <span>Closed</span></label>
        </fieldset>
        <div>
          <label for="signup-cap">Signup cap</label>
          <input id="signup-cap" name="signup_cap" type="number" min="0" step="1" inputmode="numeric" placeholder="No cap" value="${escapeHtml(capValue)}">
          <p class="note">Leave blank for no cap. Current count: ${options.settings.signupCount}${
            options.settings.signupCap === null ? "" : ` / ${options.settings.signupCap}`
          }.</p>
        </div>
        <button class="button" type="submit">Save</button>
      </form>
      <p class="admin-links"><a href="/api/admin/export.csv">Download CSV</a></p>
    </section>
    <section aria-labelledby="subs-heading">
      <h2 id="subs-heading">Submissions</h2>
      <div class="table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Email</th><th>Discord</th><th>Run</th><th>Ref</th><th>Referrals</th><th>Country</th><th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${rows || `<tr><td colspan="8">No submissions yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <p class="note">Page ${options.list.page} of ${totalPages}.</p>
      <div class="actions">${prev}${next}</div>
    </section>`,
  );
}

export async function parseSettingsForm(
  form: FormData,
): Promise<{ ok: true; isOpen: boolean; signupCap: number | null } | { ok: false; message: string }> {
  const openRaw = form.get("is_open");
  if (openRaw !== "0" && openRaw !== "1") {
    return { ok: false, message: "Choose open or closed." };
  }
  const capRaw = typeof form.get("signup_cap") === "string" ? String(form.get("signup_cap")).trim() : "";
  if (capRaw === "") return { ok: true, isOpen: openRaw === "1", signupCap: null };
  if (!/^\d+$/.test(capRaw)) return { ok: false, message: "Cap must be a whole number or blank." };
  return { ok: true, isOpen: openRaw === "1", signupCap: Number(capRaw) };
}

export { getSettings, updateSettings };
