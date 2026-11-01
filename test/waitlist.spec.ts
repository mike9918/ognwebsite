import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { snowflakeForAgeDays } from "../src/discord-age";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

const originalFetch = globalThis.fetch;
let sequence = 0;
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
      return Response.json({ access_token: "discord-access" });
    }
    if (url === "https://discord.com/api/users/@me") {
      return Response.json(mockUser);
    }
    return originalFetch(input, init);
  };
}

beforeEach(async () => {
  sequence = 0;
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
    expect(html).toContain('href="/wishlist"');

    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist?ref=CODE12"));
    const waitlist = await page.text();
    expect(waitlist).toContain("Continue with Discord");
    expect(waitlist).toContain("Why Discord to join?");
    expect(waitlist).toContain('value="CODE12"');
    expect(waitlist).not.toContain('name="email"');
    expect(waitlist).not.toContain("/api/waitlist");
  });
});

describe("discord sign-up", () => {
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
    expect(location.searchParams.get("scope")).toBe("identify email");
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
});
