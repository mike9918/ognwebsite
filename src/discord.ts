import { postWaitlistCard } from "./board";
import { content } from "./content";
import {
  isDiscordAccountOldEnough,
  minDiscordAccountAgeDays,
} from "./discord-age";
import {
  canonicalOrigin,
  cleanText,
  clearCookie,
  clientCountry,
  clientIp,
  isSecure,
  readCookie,
  secretsMatch,
  setCookie,
} from "./http";
import { randomToken, signPayload, unsignPayload } from "./signed";
import { signupBlockedReason } from "./settings";
import {
  createSignup,
  normalizeEmail,
  normalizeRef,
  normalizeRunType,
  toPublic,
  type PublicEntry,
} from "./signup";
import { verifyTurnstile } from "./turnstile";

const STATE_COOKIE = "ogn_oauth_state";
const PENDING_COOKIE = "ogn_oauth_pending";
const PENDING_MAX_AGE = 10 * 60;

type PendingSignup = {
  runType: string;
  runDetail: string;
  ref: string;
  state: string;
  expiresAt: number;
};

export type DiscordAuthError =
  | "turnstile"
  | "validation"
  | "discord"
  | "discord_email"
  | "discord_new"
  | "discord_join"
  | "discord_conflict"
  | "rate"
  | "closed"
  | "full";

export function discordConfigured(env: Env): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_BOT_TOKEN && /^\d{5,30}$/.test(env.DISCORD_GUILD_ID ?? ""));
}

// A signed, expiring draft survives cancellation and join failures. No OAuth
// access token or email is stored in the browser. Restarting rotates state.
export async function readPendingSignup(request: Request, env: Env): Promise<PendingSignup | null> {
  try {
    const payload = await unsignPayload(readCookie(request, PENDING_COOKIE) ?? "", env.DISCORD_CLIENT_SECRET);
    if (!payload) return null;
    const draft = JSON.parse(payload) as PendingSignup;
    if (!Number.isFinite(draft.expiresAt) || draft.expiresAt <= Date.now() ||
        !normalizeRunType(draft.runType) || typeof draft.runDetail !== "string" ||
        typeof draft.ref !== "string" || typeof draft.state !== "string") return null;
    return draft;
  } catch { return null; }
}

export async function beginDiscord(
  request: Request,
  env: Env,
  fields: {
    runType: string;
    runDetail: string;
    ref: string;
    token: string;
  },
): Promise<{ location: string; cookies: string[] } | { error: DiscordAuthError }> {
  if (!discordConfigured(env)) return { error: "validation" };
  const blocked = await signupBlockedReason(env.DB);
  if (blocked) return { error: blocked };
  const runType = normalizeRunType(fields.runType);
  if (!runType) return { error: "validation" };
  if (!(await verifyTurnstile(request, env, fields.token))) return { error: "turnstile" };

  const state = randomToken(32);
  const pending: PendingSignup = {
    runType,
    runDetail: fields.runDetail,
    ref: normalizeRef(fields.ref) ?? "",
    state,
    expiresAt: Date.now() + PENDING_MAX_AGE * 1000,
  };
  const secure = isSecure(request);
  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/discord/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify email guilds.join");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("prompt", "consent");

  return {
    location: authorize.toString(),
    cookies: [
      setCookie(STATE_COOKIE, state, { maxAge: PENDING_MAX_AGE, secure }),
      setCookie(PENDING_COOKIE, await signPayload(JSON.stringify(pending), env.DISCORD_CLIENT_SECRET), {
        maxAge: PENDING_MAX_AGE,
        secure,
      }),
    ],
  };
}

export async function finishDiscord(
  request: Request,
  env: Env,
): Promise<{ entry: PublicEntry; cookies: string[] } | { error: DiscordAuthError; cookies: string[] }> {
  const secure = isSecure(request);
  const cleared = [clearCookie(STATE_COOKIE, secure)];
  if (!discordConfigured(env)) return { error: "discord_join", cookies: cleared };
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = readCookie(request, STATE_COOKIE) ?? "";
  if (!code || !state || !(await secretsMatch(state, stateCookie))) {
    return { error: "discord", cookies: cleared };
  }

  const pending = await readPendingSignup(request, env);
  if (!pending) return { error: "discord", cookies: cleared };
  if (pending.state !== state) return { error: "discord", cookies: cleared };

  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/discord/callback`;
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
    const tokenJson = (await tokenResponse.json()) as { access_token?: string; scope?: string };
    const accessToken = tokenJson.access_token ?? "";
    if (!accessToken) return { error: "discord", cookies: cleared };
    if (!tokenJson.scope?.split(" ").includes("guilds.join")) {
      console.error(JSON.stringify({ event: "discord_join_failed", reason: "missing_scope" }));
      return { error: "discord_join", cookies: cleared };
    }
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userResponse.ok) return { error: "discord", cookies: cleared };
    const user = (await userResponse.json()) as {
      id?: string;
      username?: string;
      email?: string | null;
      verified?: boolean;
    };
    if (!user.id || !/^\d{5,30}$/.test(user.id)) return { error: "discord", cookies: cleared };
    const email = normalizeEmail(user.email ?? "");
    if (!email || user.verified !== true) return { error: "discord_email", cookies: cleared };

    const minAge = minDiscordAccountAgeDays(env.MIN_DISCORD_ACCOUNT_AGE_DAYS);
    if (!isDiscordAccountOldEnough(user.id, minAge, new Date())) {
      return { error: "discord_new", cookies: cleared };
    }

    const runType = normalizeRunType(pending.runType);
    if (!runType) return { error: "discord", cookies: cleared };
    const username = cleanText(user.username ?? "", 32);
    const detail = cleanText(pending.runDetail, 120);
    // Never associate one Discord user's membership with another user's row.
    const emailOwner = await env.DB.prepare("SELECT discord_id FROM waitlist WHERE email = ?")
      .bind(email).first<{ discord_id: string | null }>();
    if (emailOwner && emailOwner.discord_id !== user.id) {
      return { error: "discord_conflict", cookies: cleared };
    }
    const blocked = await signupBlockedReason(env.DB);
    if (blocked) return { error: blocked, cookies: cleared };
    let joined: Response;
    try {
      joined = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${user.id}`, {
        method: "PUT",
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      console.error(JSON.stringify({ event: "discord_join_failed", reason: "network_or_timeout" }));
      return { error: "discord_join", cookies: cleared };
    }
    // 204 means already a member; do not try to parse its empty response.
    if (joined.status !== 201 && joined.status !== 204) {
      // Only retain numeric diagnostics: Discord response bodies can contain
      // sensitive data, so never log the request, token or full response.
      let discordCode: number | null = null;
      try {
        const body = await joined.json() as { code?: unknown };
        if (typeof body.code === "number") discordCode = body.code;
      } catch { /* Non-JSON upstream errors still have an HTTP status. */ }
      console.error(JSON.stringify({ event: "discord_join_failed", reason: "api", status: joined.status, discordCode }));
      return { error: "discord_join", cookies: cleared };
    }
    const created = await createSignup(env.DB, {
      email,
      discordId: user.id,
      discordUsername: username || null,
      runType,
      runDetail: detail || null,
      ref: pending.ref ? normalizeRef(pending.ref) : null,
      ip: clientIp(request),
      country: clientCountry(request),
      salt: env.IP_HASH_SALT,
      now: new Date(),
    });
    if (!created.ok) return { error: created.error, cookies: cleared };
    if (created.row.discord_id !== user.id) return { error: "discord_conflict", cookies: cleared };
    await env.DB.prepare("UPDATE waitlist SET discord_joined_at = ?, discord_dm_consent_at = ? WHERE id = ? AND discord_id = ?")
      .bind(new Date().toISOString(), new Date().toISOString(), created.row.id, user.id).run();
    // One card per person: a repeat signup returns the existing row and keeps
    // the message that entry already has. A row with no card yet (created
    // before this feature, or deleted in Discord) gets one on the next signup.
    if (!created.row.discord_message_id) await postWaitlistCard(env, env.DB, created.row);
    console.log(
      JSON.stringify({
        event: "waitlist_signup",
        existing: created.existing,
        country: clientCountry(request),
        via: "discord",
      }),
    );
    return {
      entry: await toPublic(env.DB, created.row, origin, created.existing),
      cookies: [...cleared, clearCookie(PENDING_COOKIE, secure)],
    };
  } catch {
    console.error(JSON.stringify({ event: "discord_oauth_failed" }));
    return { error: "discord", cookies: cleared };
  }
}

export function discordErrorMessage(error: DiscordAuthError): string {
  if (error === "discord_join") return content.errors.discordJoin;
  if (error === "discord_conflict") return content.errors.discordConflict;
  if (error === "discord_email") return content.errors.discordEmail;
  if (error === "discord_new") return content.errors.discordNew;
  if (error === "rate") return content.errors.rate;
  if (error === "closed") return content.errors.closed;
  if (error === "full") return content.errors.full;
  if (error === "turnstile") return content.errors.turnstile;
  if (error === "validation") return content.errors.validation;
  return content.errors.discord;
}
