import { content } from "./content";
import { isAtLeast13, parseBirth } from "./age";
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
  month: number;
  year: number;
  runType: string;
  runDetail: string;
  ref: string;
  state: string;
};

export function discordEnabled(env: Env): boolean {
  return Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)),
  );
  return `${bytesToBase64Url(new TextEncoder().encode(payload))}.${bytesToBase64Url(signature)}`;
}

async function unsign(token: string, secret: string): Promise<string | null> {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, base64UrlToBytes(payload)),
  );
  let provided: Uint8Array;
  try {
    provided = base64UrlToBytes(signature);
  } catch {
    return null;
  }
  if (expected.length !== provided.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= (expected[index] ?? 0) ^ (provided[index] ?? 0);
  }
  if (mismatch !== 0) return null;
  return new TextDecoder().decode(base64UrlToBytes(payload));
}

export async function beginDiscord(
  request: Request,
  env: Env,
  fields: {
    month: string;
    year: string;
    runType: string;
    runDetail: string;
    ref: string;
    token: string;
  },
): Promise<{ location: string; cookies: string[] } | { error: "age" | "turnstile" | "validation" }> {
  if (!discordEnabled(env)) return { error: "validation" };
  const now = new Date();
  const birth = parseBirth(fields.month, fields.year, now);
  const runType = normalizeRunType(fields.runType);
  if (!birth.ok || !runType) return { error: "validation" };
  if (!isAtLeast13(birth.year, birth.month, now)) return { error: "age" };
  if (!(await verifyTurnstile(request, env, fields.token))) return { error: "turnstile" };

  const stateBytes = new Uint8Array(32);
  crypto.getRandomValues(stateBytes);
  const state = bytesToBase64Url(stateBytes);
  const pending: PendingSignup = {
    month: birth.month,
    year: birth.year,
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
      setCookie(PENDING_COOKIE, await sign(JSON.stringify(pending), env.DISCORD_CLIENT_SECRET), {
        maxAge: PENDING_MAX_AGE,
        secure,
      }),
    ],
  };
}

export async function finishDiscord(
  request: Request,
  env: Env,
): Promise<{ entry: PublicEntry; cookies: string[] } | { error: "discord" | "discord_email" | "age" | "rate"; cookies: string[] }> {
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

  const payload = await unsign(pendingCookie, env.DISCORD_CLIENT_SECRET);
  if (!payload) return { error: "discord", cookies: cleared };
  let pending: PendingSignup;
  try {
    pending = JSON.parse(payload) as PendingSignup;
  } catch {
    return { error: "discord", cookies: cleared };
  }
  if (pending.state !== state) return { error: "discord", cookies: cleared };
  const now = new Date();
  if (!isAtLeast13(pending.year, pending.month, now)) return { error: "age", cookies: cleared };

  const origin = canonicalOrigin(request, env.PUBLIC_ORIGIN);
  const redirectUri = `${origin}/api/auth/discord/callback`;
  let accessToken = "";
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
    accessToken = tokenJson.access_token ?? "";
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
    };
    const email = normalizeEmail(user.email ?? "");
    if (!user.id || !email) return { error: "discord_email", cookies: cleared };
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
      now,
    });
    if (!created.ok) return { error: "rate", cookies: cleared };
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

export function discordErrorMessage(error: "discord" | "discord_email" | "age" | "rate"): string {
  if (error === "discord_email") return content.errors.discordEmail;
  if (error === "age") return content.ageBlocked;
  if (error === "rate") return content.errors.rate;
  return content.errors.discord;
}
