import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { snowflakeForAgeDays } from "../src/discord-age";
import { discordConfigured, readPendingSignup } from "../src/discord";
import { signPayload } from "../src/signed";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

const originalFetch = globalThis.fetch;
let sequence = 0;
let joinStatus = 201;
let joinCalls = 0;
let mockScope = "identify email guilds.join";
let cardMessages: Array<{ content: string; allowed_mentions?: unknown }> = [];
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
    if (url === "https://discord.com/api/v10/channels/555000111222333444/messages") {
      cardMessages.push(
        JSON.parse(String(init?.body)) as { content: string; allowed_mentions?: unknown },
      );
      return Response.json({ id: "card-1" });
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
  cardMessages = [];
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
      "UPDATE waitlist_settings SET is_open = 1, signup_cap = NULL, auto_provision = 0, updated_at = ?",
    ).bind(new Date().toISOString()),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
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
  it("serves the homepage and the Discord-only sign-up", async () => {
    const home = await exports.default.fetch(workerRequest("https://opengamenode.com/"));
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("Free game servers. More time to play.");
    expect(html).toContain("Free Minecraft server hosting");
    expect(html).toContain("OpenGameNode — Free Minecraft Server Hosting");
    expect(html).toContain('rel="canonical" href="https://opengamenode.com"');
    expect(html).toContain("application/ld+json");
    expect(html).toContain("opengamnode");
    expect(html).toContain('action="/api/auth/discord"');
    expect(html).toContain("Sign up free with Discord");
    expect(html).toContain("Open to everyone");

    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/signup"));
    expect(page.status).toBe(200);
    const signup = await page.text();
    expect(signup).toContain("Sign up free with Discord");
    expect(signup).toContain("Is it really free?");
    expect(signup).not.toContain('name="ref"');
    expect(signup).not.toContain('name="email"');
    expect(signup).not.toContain("/api/waitlist");
  });

  it("exposes capacity as a boolean and nothing else", async () => {
    const response = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/capacity"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ accepting: true });
  });

  it("replaces the sign-up form with an at-capacity message", async () => {
    await env.DB.prepare(
      "UPDATE waitlist_settings SET is_open = 1, signup_cap = 0, updated_at = ?",
    )
      .bind(new Date().toISOString())
      .run();
    const home = await (
      await exports.default.fetch(workerRequest("https://opengamenode.com/"))
    ).text();
    expect(home).toContain("At capacity right now");
    expect(home).not.toContain('action="/api/auth/discord"');
    expect(home).not.toContain("limited slot");
    const flag = await (
      await exports.default.fetch(workerRequest("https://opengamenode.com/api/capacity"))
    ).json();
    expect(flag).toEqual({ accepting: false });
  });

  it("keeps waitlist framing off every public page", async () => {
    for (const path of ["/", "/signup", "/faq", "/help", "/help/first-server", "/free-minecraft-server", "/supporter"]) {
      const html = await (
        await exports.default.fetch(workerRequest(`https://opengamenode.com${path}`))
      ).text();
      // Visible text only: internal ids, asset names and CSS classes may still
      // say "waitlist" without any visitor seeing the word.
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .toLowerCase();
      expect(text, path).not.toContain("waitlist");
      expect(text, path).not.toContain("limited slot");
    }
  });
});

describe("search", () => {
  it("publishes a sitemap and robots file", async () => {
    const sitemap = await exports.default.fetch(workerRequest("https://opengamenode.com/sitemap.xml"));
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get("Content-Type")).toContain("xml");
    const xml = await sitemap.text();
    expect(xml).toContain("https://opengamenode.com/free-minecraft-server");
    expect(xml).toContain("https://opengamenode.com/signup");
    expect(xml).toContain("https://opengamenode.com/faq");
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/wishlist");
    expect(xml).not.toContain("/api/");

    const robots = await exports.default.fetch(workerRequest("https://opengamenode.com/robots.txt"));
    expect(robots.status).toBe(200);
    const text = await robots.text();
    expect(text).toContain("Sitemap: https://opengamenode.com/sitemap.xml");
    expect(text).toContain("Disallow: /admin");
    expect(text).toContain("Disallow: /api/");
  });

  it("redirects short urls onto the canonical pages", async () => {
    const wishlist = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist"));
    expect(wishlist.status).toBe(301);
    expect(wishlist.headers.get("Location")).toBe("/signup");

    const minecraft = await exports.default.fetch(workerRequest("https://opengamenode.com/minecraft"));
    expect(minecraft.status).toBe(301);
    expect(minecraft.headers.get("Location")).toBe("/free-minecraft-server");
  });

  it("describes the free Minecraft server with the real plan limits", async () => {
    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/free-minecraft-server"));
    expect(page.status).toBe(200);
    expect(page.headers.get("Cache-Control")).toContain("public");
    const html = await page.text();
    expect(html).toContain("Free Minecraft Server Hosting · OpenGameNode");
    expect(html).toContain("<h1>Free Minecraft server hosting</h1>");
    expect(html).toContain("2 GB");
    expect(html).toContain("3 GB");
    expect(html).toContain("10 GB");
    expect(html).toContain("Minecraft Java");
    expect(html).toContain("Bedrock");
    expect(html).toContain("application/ld+json");
    expect(html).toContain("FAQPage");
    expect(html).not.toContain("noindex");
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").toLowerCase();
    expect(text).not.toContain("waitlist");
  });

  it("keeps missing pages out of the index", async () => {
    const missing = await exports.default.fetch(workerRequest("https://opengamenode.com/no-such-page"));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("noindex");
  });
});

describe("discord sign-up", () => {
  it("logs numeric join diagnostics without credentials or user information", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    joinStatus = 403;
    await finishDiscord(await startDiscord());
    expect(logged).toHaveBeenCalledWith(JSON.stringify({ event: "discord_join_failed", reason: "api", status: 403, discordCode: null }));
    const output = JSON.stringify(logged.mock.calls);
    expect(output).not.toContain("discord-access");
    expect(output).not.toContain("test-bot-token");
    expect(output).not.toContain(mockUser.email);
  });
  it("requires the bot configuration and rejects expired signed drafts", async () => {
    expect(discordConfigured({ ...env, DISCORD_BOT_TOKEN: "" })).toBe(false);
    expect(discordConfigured({ ...env, DISCORD_GUILD_ID: "not-a-guild" })).toBe(false);
    const draft = await signPayload(JSON.stringify({ runType: "vanilla", runDetail: "", state: "test", expiresAt: Date.now() - 1 }), env.DISCORD_CLIENT_SECRET);
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

  it("posts one waitlist card per person and stores it for the provisioned edit", async () => {
    await discordSignup({ run_type: "modpack", run_detail: "ATM10" });
    expect(cardMessages).toHaveLength(1);
    expect(cardMessages[0].content).toContain("New sign-up");
    expect(cardMessages[0].content).toContain("ada@example.com");
    expect(cardMessages[0].content).toContain("ATM10");
    expect(cardMessages[0].content).toContain("3 GB RAM · Modpack");
    // A handle is never allowed to ping the guild.
    expect(cardMessages[0].allowed_mentions).toEqual({ parse: [] });
    const row = await env.DB.prepare(
      "SELECT discord_channel_id, discord_message_id FROM waitlist",
    ).first();
    expect(row).toEqual({
      discord_channel_id: "555000111222333444",
      discord_message_id: "card-1",
    });

    // The same person signing up again is not a new arrival.
    await discordSignup();
    expect(cardMessages).toHaveLength(1);
  });

  it.each([403, 429, 500])("does not complete signup when Discord join returns %s", async (status) => {
    joinStatus = status;
    const start = await startDiscord({ run_type: "modpack", run_detail: "Create" });
    const callback = await finishDiscord(start);
    expect(callback.headers.get("Location")).toBe("/wishlist?error=discord_join");
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(0);
    const cookies = start.headers.getSetCookie().map(c => c.split(";")[0]).join("; ");
    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist?error=discord_join", { headers: { Cookie: cookies } }));
    const html = await page.text();
    expect(html).toContain('value="modpack" checked');
    expect(html).toContain('value="Create"');
    expect(html).not.toContain('name="ref"');
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
    expect(html).toContain("You&#39;re signed up.");
    expect(html).toContain("noindex");
    expect(html).toContain("ada@example.com");
    expect(html).toContain("we&#39;ve got your Discord account");
    expect(html).not.toContain("setting up your server now");

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

  it("queues every sign-up for provisioning", async () => {
    await discordSignup();
    const row = await env.DB.prepare("SELECT provision_state FROM waitlist").first<{
      provision_state: string | null;
    }>();
    expect(row?.provision_state).toBe("queued");
  });

  it("does not charge failed rows against the cap", async () => {
    await env.DB.prepare(
      `INSERT INTO waitlist (email, run_type, ref_code, ip_hash, created_at, provision_state)
       VALUES ('failed@example.com', 'vanilla', 'FAILED01', 'hash', '2026-01-01T00:00:00.000Z', 'failed')`,
    ).run();
    await env.DB.prepare("UPDATE waitlist_settings SET signup_cap = 1 WHERE id = 1").run();
    const signup = await discordSignup();
    expect(signup.welcome).toMatch(/^\/wishlist\?welcome=/);
    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(2);
  });

  it("shows automatic preparing copy when auto provision is on", async () => {
    await env.DB.prepare("UPDATE waitlist_settings SET auto_provision = 1 WHERE id = 1").run();
    const first = await discordSignup();
    const html = await (
      await exports.default.fetch(workerRequest(`https://opengamenode.com${first.welcome}`))
    ).text();
    expect(html).toContain("setting up your server now");
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

  it("respects open or closed and the cap", async () => {
    await discordSignup();

    mockUser = {
      id: snowflakeForAgeDays(70),
      username: "friend1",
      email: "friend1@example.com",
      verified: true,
    };
    await discordSignup();
    mockUser = {
      id: snowflakeForAgeDays(75),
      username: "friend2",
      email: "friend2@example.com",
      verified: true,
    };
    await discordSignup();

    expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM waitlist").first("n")).toBe(3);

    await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: await adminSessionCookie(),
        },
        body: formBody({ is_open: "0", signup_cap: "", auto_provision: "0" }),
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
        body: formBody({ is_open: "1", signup_cap: "3", auto_provision: "0" }),
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
    expect(html).toContain("Sign-up controls");
    expect(html).toContain("ada@example.com");
    expect(html).toContain('name="signup_cap"');
    expect(html).toContain('name="auto_provision"');
    expect(html).toContain("Manual — staff click Provision");
    expect(html).not.toContain("Referrals");
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
    expect(afterHtml).toContain("Sign-up deleted.");
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
