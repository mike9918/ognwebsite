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
};

export type DiscordAuthError =
  | "turnstile"
  | "validation"
  | "discord"
  | "discord_email"
  | "discord_new"
  | "rate"
  | "closed"
  | "full";

export function discordConfigured(env: Env): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
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
  };
  const secure = isSecure(request);
  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/discord/callback`;
  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set("scope", "identify email");
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
  const cleared = [clearCookie(STATE_COOKIE, secure), clearCookie(PENDING_COOKIE, secure)];
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const stateCookie = readCookie(request, STATE_COOKIE) ?? "";
  const pendingCookie = readCookie(request, PENDING_COOKIE) ?? "";
  if (!code || !state || !(await secretsMatch(state, stateCookie))) {
    return { error: "discord", cookies: cleared };
  }

  const payload = await unsignPayload(pendingCookie, env.DISCORD_CLIENT_SECRET);
  if (!payload) return { error: "discord", cookies: cleared };
  let pending: PendingSignup;
  try {
    pending = JSON.parse(payload) as PendingSignup;
  } catch {
    return { error: "discord", cookies: cleared };
  }
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
    const tokenJson = (await tokenResponse.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token ?? "";
    if (!accessToken) return { error: "discord", cookies: cleared };
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
    if (!user.id) return { error: "discord", cookies: cleared };
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
      cookies: cleared,
    };
  } catch {
    console.error(JSON.stringify({ event: "discord_oauth_failed" }));
    return { error: "discord", cookies: cleared };
  }
}

export function discordErrorMessage(error: DiscordAuthError): string {
  if (error === "discord_email") return content.errors.discordEmail;
  if (error === "discord_new") return content.errors.discordNew;
  if (error === "rate") return content.errors.rate;
  if (error === "closed") return content.errors.closed;
  if (error === "full") return content.errors.full;
  if (error === "turnstile") return content.errors.turnstile;
  if (error === "validation") return content.errors.validation;
  return content.errors.discord;
}
