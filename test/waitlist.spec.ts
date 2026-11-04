import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { snowflakeForAgeDays } from "../src/discord-age";
import { discordConfigured, readPendingSignup } from "../src/discord";
import { signPayload } from "../src/signed";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

const originalFetch = globalThis.fetch;
let sequence = 0;
let joinStatus = 201;
let joinCalls = 0;
let mockScope = "identify email guilds.join";
let mockUser: {
  id: string;
  username: string;
  email: string | null;
  verified: boolean;
} = {
  id: snowflakeForAgeDays(60),
  username: "ada",
  email: "Ada@Example.com",
  verified: true,
};

function nextIp(): string {
  sequence += 1;
  return `203.0.113.${sequence}`;
}

function installFetchMock(): void {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
      const params = new URLSearchParams(String(init?.body ?? ""));
      const token = params.get("response");
      if (token === "pass" || token === "testing" || token === "XXXX.DUMMY.TOKEN.XXXX") {
        return Response.json({ success: true, hostname: "example.com", action: "signup" });
      }
      return Response.json({ success: false, hostname: "example.com", "error-codes": ["invalid-input-response"] });
    }
    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({ access_token: "discord-access", scope: mockScope });
    }
    if (url === "https://discord.com/api/users/@me") {
      return Response.json(mockUser);
    }
    if (url.startsWith("https://discord.com/api/v10/guilds/123456789012345678/members/")) {
      joinCalls += 1;
      expect(init?.method).toBe("PUT");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bot test-bot-token");
      expect(JSON.parse(String(init?.body))).toEqual({ access_token: "discord-access" });
      return joinStatus === 204 ? new Response(null, { status: 204 }) : Response.json({ pending: true }, { status: joinStatus });
    }
    return originalFetch(input, init);
  };
}

beforeEach(async () => {
  sequence = 0;
  joinStatus = 201;
  joinCalls = 0;
  mockScope = "identify email guilds.join";
  mockUser = {
    id: snowflakeForAgeDays(60),
    username: "ada",
    email: "Ada@Example.com",
    verified: true,
  };
  installFetchMock();
  await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM waitlist"),
    env.DB.prepare("DELETE FROM signup_attempts"),
    env.DB.prepare(
      "UPDATE waitlist_settings SET is_open = 1, signup_cap = NULL, updated_at = ?",
    ).bind(new Date().toISOString()),
  ]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function formBody(fields: Record<string, string>): string {
  return new URLSearchParams(fields).toString();
}

function workerRequest(url: string, init: RequestInit = {}): Request {
  return new Request(url, { redirect: "manual", ...init });
}

async function startDiscord(
  fields: Record<string, string> = {},
  ip = nextIp(),
): Promise<Response> {
  return exports.default.fetch(
    workerRequest("https://opengamenode.com/api/auth/discord", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "CF-Connecting-IP": ip,
        "CF-IPCountry": "US",
      },
      body: formBody({
        run_type: "vanilla",
        "cf-turnstile-response": "pass",
        ...fields,
      }),
    }),
  );
}

async function finishDiscord(start: Response): Promise<Response> {
  const location = new URL(start.headers.get("Location") ?? "");
  const cookies = start.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  return exports.default.fetch(
    workerRequest(
      `https://opengamenode.com/api/auth/discord/callback?code=auth-code&state=${location.searchParams.get("state")}`,
      { headers: { Cookie: cookies, "CF-Connecting-IP": nextIp() } },
    ),
  );
}

async function discordSignup(fields: Record<string, string> = {}): Promise<{
  start: Response;
  callback: Response;
  welcome: string;
}> {
  const start = await startDiscord(fields);
  expect(start.status, start.headers.get("Location") ?? "").toBe(302);
  const callback = await finishDiscord(start);
  expect(callback.status, callback.headers.get("Location") ?? "").toBe(303);
  const welcome = callback.headers.get("Location") ?? "";
  return { start, callback, welcome };
}

describe("pages", () => {
  it("serves the homepage and Discord-only waitlist", async () => {
    const home = await exports.default.fetch(workerRequest("https://opengamenode.com/"));
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("Free game servers. More time to play.");
    expect(html).toContain('action="/api/auth/discord"');
    expect(html).toContain("Open to everyone");

    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist?ref=CODE12"));
    const waitlist = await page.text();
    expect(waitlist).toContain("Connect Discord &amp; Join OGN");
    expect(waitlist).toContain("Is it really free?");
    expect(waitlist).toContain('value="CODE12"');
    expect(waitlist).not.toContain('name="email"');
    expect(waitlist).not.toContain("/api/waitlist");
  });
});

describe("discord sign-up", () => {
  it("requires the bot configuration and rejects expired signed drafts", async () => {
    expect(discordConfigured({ ...env, DISCORD_BOT_TOKEN: "" })).toBe(false);
    expect(discordConfigured({ ...env, DISCORD_GUILD_ID: "not-a-guild" })).toBe(false);
    const draft = await signPayload(JSON.stringify({ runType: "vanilla", runDetail: "", ref: "", state: "test", expiresAt: Date.now() - 1 }), env.DISCORD_CLIENT_SECRET);
    const request = workerRequest("https://opengamenode.com/wishlist", { headers: { Cookie: `ogn_oauth_pending=${encodeURIComponent(draft)}` } });
    expect(await readPendingSignup(request, env)).toBeNull();
  });
  it.each([201, 204])("records Discord membership and notification consent for status %s", async (status) => {
    joinStatus = status;
    await discordSignup();
    const row = await env.DB.prepare("SELECT discord_id, discord_joined_at, discord_dm_consent_at FROM waitlist").first();
    expect(row?.discord_id).toBe(mockUser.id);
    expect(row?.discord_joined_at).toBeTruthy();
    expect(row?.discord_dm_consent_at).toBeTruthy();
    expect(joinCalls).toBe(1);
  });

  it.each([403, 429, 500])("does not complete signup when Discord join returns %s", async (status) => {
    joinStatus = status;
    const start = await startDiscord({ run_type: "modpack", run_detail: "Create", ref: "FRIEND12" });
    const callback = await finishDiscord(start);
    expect(callback.headers.get("Location")).toBe("/wishlist?error=discord_join");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(0);
    const cookies = start.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist?error=discord_join", { headers: { Cookie: cookies } }));
    const html = await page.text();
    expect(html).toContain('value="modpack" checked');
    expect(html).toContain('value="Create"');
    expect(html).toContain('value="FRIEND12"');
    expect(html).toContain("Your signup is not complete");
    joinStatus = 204;
    await discordSignup({ run_type: "modpack", run_detail: "Create" });
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(1);
  });

  it("rejects missing join consent before calling the guild endpoint", async () => {
    mockScope = "identify email";
    const callback = await finishDiscord(await startDiscord());
    expect(callback.headers.get("Location")).toBe("/wishlist?error=discord_join");
    expect(joinCalls).toBe(0);
  });

  it("does not attach membership to another Discord identity with the same email", async () => {
    await discordSignup();
    mockUser = { ...mockUser, id: snowflakeForAgeDays(100) };
    const callback = await finishDiscord(await startDiscord());
    expect(callback.headers.get("Location")).toBe("/wishlist?error=discord_conflict");
    expect(joinCalls).toBe(1);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(1);
  });

  it("preserves the draft after cancelled OAuth without joining or signing up", async () => {
    const start = await startDiscord({ run_detail: "Fabric" });
    const cookies = start.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const callback = await exports.default.fetch(workerRequest("https://opengamenode.com/api/auth/discord/callback?error=access_denied", { headers: { Cookie: cookies } }));
    expect(callback.headers.get("Location")).toBe("/wishlist?error=discord");
    expect(callback.headers.getSetCookie().join(";")).not.toContain("ogn_oauth_pending=");
    expect(joinCalls).toBe(0);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(0);
  });

  it("creates one row and returns the same entry for the same Discord account", async () => {
    const first = await discordSignup({ run_type: "modpack", run_detail: "Create" });
    expect(first.welcome).toMatch(/^\/wishlist\?welcome=/);
    const page = await exports.default.fetch(workerRequest(`https://opengamenode.com${first.welcome}`));
    const html = await page.text();
    expect(html).toContain("You&#39;re on the list.");
    expect(html).toContain("ada@example.com");

    const again = await discordSignup({ run_type: "vanilla" });
    expect(again.welcome).toBe(first.welcome);

    const emailOnly = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: formBody({ email: "nope@example.com", run_type: "vanilla", "cf-turnstile-response": "pass" }),
      }),
    );
    expect(emailOnly.status).toBe(410);
  });

  it("returns a Discord location as JSON for the waitlist script", async () => {
    const response = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/auth/discord", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
          "CF-Connecting-IP": nextIp(),
          "CF-IPCountry": "US",
        },
        body: formBody({
          run_type: "vanilla",
          "cf-turnstile-response": "pass",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { location?: string };
    expect(payload.location).toMatch(/^https:\/\/discord\.com\/oauth2\/authorize\?/);
    expect(response.headers.getSetCookie().join("\n")).toContain("ogn_oauth_state=");
  });

  it("rejects unverified email, new accounts, and bad state", async () => {
    mockUser = { ...mockUser, verified: false, id: snowflakeForAgeDays(90) };
    const unverifiedStart = await startDiscord();
    const unverified = await finishDiscord(unverifiedStart);
    expect(unverified.headers.get("Location")).toBe("/wishlist?error=discord_email");

    mockUser = {
      id: snowflakeForAgeDays(5),
      username: "newbie",
      email: "new@example.com",
      verified: true,
    };
    const youngStart = await startDiscord();
    const young = await finishDiscord(youngStart);
    expect(young.headers.get("Location")).toBe("/wishlist?error=discord_new");

    mockUser = {
      id: snowflakeForAgeDays(80),
      username: "ok",
      email: "ok@example.com",
      verified: true,
    };
    const start = await startDiscord();
    const location = new URL(start.headers.get("Location") ?? "");
    const cookies = start.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
    const badState = await exports.default.fetch(
      workerRequest(
        `https://opengamenode.com/api/auth/discord/callback?code=auth-code&state=not-the-state`,
        { headers: { Cookie: cookies } },
      ),
    );
    expect(badState.headers.get("Location")).toBe("/wishlist?error=discord");
    expect(location.searchParams.get("scope")).toBe("identify email guilds.join");
  });

  it("counts referrals and respects open or closed and the cap", async () => {
    const anchor = await discordSignup();
    const ref = (anchor.welcome.match(/welcome=([A-Z0-9]+)/) ?? [])[1];
    expect(ref).toBeTruthy();

    mockUser = {
      id: snowflakeForAgeDays(70),
      username: "friend1",
      email: "friend1@example.com",
      verified: true,
    };
    await discordSignup({ ref: ref! });
    mockUser = {
      id: snowflakeForAgeDays(75),
      username: "friend2",
      email: "friend2@example.com",
      verified: true,
    };
    await discordSignup({ ref: ref!.toLowerCase() });

    const csv = await (
      await exports.default.fetch(
        workerRequest("https://opengamenode.com/api/admin/export.csv", {
          headers: { Authorization: "Bearer test-admin-token" },
        }),
      )
    ).text();
    const anchorRow = csv.split("\r\n").find((line) => line.includes(`,${ref},`));
    expect(anchorRow?.split(",")[8]).toBe("2");

    await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: await adminSessionCookie(),
        },
        body: formBody({ is_open: "0", signup_cap: "" }),
      }),
    );
    mockUser = {
      id: snowflakeForAgeDays(85),
      username: "closed",
      email: "closed@example.com",
      verified: true,
    };
    const closedStart = await startDiscord();
    expect(closedStart.status).toBe(303);
    expect(closedStart.headers.get("Location")).toBe("/wishlist?error=closed");

    await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: await adminSessionCookie(),
        },
        body: formBody({ is_open: "1", signup_cap: "3" }),
      }),
    );
    mockUser = {
      id: snowflakeForAgeDays(88),
      username: "full",
      email: "full@example.com",
      verified: true,
    };
    const fullStart = await startDiscord();
    expect(fullStart.headers.get("Location")).toBe("/wishlist?error=full");
  });
});

async function adminSessionCookie(): Promise<string> {
  mockUser = {
    id: "111222333444555666",
    username: "michael",
    email: null,
    verified: true,
  };
  const start = await exports.default.fetch(
    workerRequest("https://opengamenode.com/api/auth/admin/discord", { redirect: "manual" }),
  );
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get("Location") ?? "");
  const cookies = start.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  const callback = await exports.default.fetch(
    workerRequest(
      `https://opengamenode.com/api/auth/admin/discord/callback?code=admin-code&state=${location.searchParams.get("state")}`,
      { headers: { Cookie: cookies } },
    ),
  );
  expect(callback.status).toBe(303);
  expect(callback.headers.get("Location")).toBe("/admin");
  return callback.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((cookie) => cookie.startsWith("ogn_admin_session="))
    .join("; ");
}

describe("admin", () => {
  it("lets an allowlisted Discord account manage settings and see submissions", async () => {
    mockUser = {
      id: snowflakeForAgeDays(60),
      username: "ada",
      email: "Ada@Example.com",
      verified: true,
    };
    await discordSignup();

    const cookie = await adminSessionCookie();
    const page = await exports.default.fetch(
      workerRequest("https://opengamenode.com/admin", { headers: { Cookie: cookie } }),
    );
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain("Waitlist controls");
    expect(html).toContain("ada@example.com");
    expect(html).toContain('name="signup_cap"');
    expect(html).toContain("Signed in as");

    const forbiddenUser = {
      id: snowflakeForAgeDays(99),
      username: "intruder",
      email: null,
      verified: true,
    };
    mockUser = forbiddenUser;
    const start = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/auth/admin/discord"),
    );
    const location = new URL(start.headers.get("Location") ?? "");
    const cookies = start.headers.getSetCookie().map((cookieValue) => cookieValue.split(";")[0]).join("; ");
    const denied = await exports.default.fetch(
      workerRequest(
        `https://opengamenode.com/api/auth/admin/discord/callback?code=x&state=${location.searchParams.get("state")}`,
        { headers: { Cookie: cookies } },
      ),
    );
    expect(denied.headers.get("Location")).toBe("/admin?error=forbidden");
  });

  it("deletes a waitlist entry from the admin session", async () => {
    mockUser = {
      id: snowflakeForAgeDays(61),
      username: "deleteme",
      email: "delete-me@example.com",
      verified: true,
    };
    await discordSignup();

    const cookie = await adminSessionCookie();
    const before = await exports.default.fetch(
      workerRequest("https://opengamenode.com/admin", { headers: { Cookie: cookie } }),
    );
    const beforeHtml = await before.text();
    expect(beforeHtml).toContain("delete-me@example.com");
    expect(beforeHtml).toContain(">Provision<");
    expect(beforeHtml).toContain('action="/api/admin/entries/delete"');

    const idMatch = beforeHtml.match(
      /delete-me@example\.com[\s\S]*?name="id" value="(\d+)"/,
    );
    expect(idMatch?.[1]).toBeTruthy();

    const deleted = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/entries/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookie,
        },
        body: formBody({ id: idMatch![1]! }),
      }),
    );
    expect(deleted.status).toBe(303);
    expect(deleted.headers.get("Location")).toBe("/admin?deleted=1");

    const after = await exports.default.fetch(
      workerRequest("https://opengamenode.com/admin?deleted=1", { headers: { Cookie: cookie } }),
    );
    const afterHtml = await after.text();
    expect(afterHtml).toContain("Waitlist entry deleted.");
    expect(afterHtml).not.toContain("delete-me@example.com");

    const missing = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/entries/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookie,
        },
        body: formBody({ id: idMatch![1]! }),
      }),
    );
    expect(missing.headers.get("Location")).toBe("/admin?deleted=missing");
  });
});
