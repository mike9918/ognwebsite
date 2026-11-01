import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

const originalFetch = globalThis.fetch;
let sequence = 0;

function nextIp(): string {
  sequence += 1;
  return `203.0.113.${sequence}`;
}

function nextEmail(): string {
  sequence += 1;
  return `person${sequence}@example.com`;
}

function adultBirth(): { birth_month: string; birth_year: string } {
  return {
    birth_month: "1",
    birth_year: String(new Date().getUTCFullYear() - 30),
  };
}

function installFetchMock(): void {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith("https://challenges.cloudflare.com/turnstile/v0/siteverify")) {
      const params = new URLSearchParams(String(init?.body ?? ""));
      const token = params.get("response");
      if (token === "pass" || token === "testing") {
        const body =
          token === "pass"
            ? { success: true, hostname: "example.com", action: "signup" }
            : { success: true, hostname: "example.com", metadata: { result_with_testing_key: true } };
        return Response.json(body);
      }
      if (token === "wrong-host") {
        return Response.json({ success: true, hostname: "evil.example", action: "signup" });
      }
      if (token === "wrong-action") {
        return Response.json({ success: true, hostname: "example.com", action: "login" });
      }
      return Response.json({ success: false, hostname: "example.com", "error-codes": ["invalid-input-response"] });
    }
    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({ access_token: "discord-access" });
    }
    if (url === "https://discord.com/api/users/@me") {
      return Response.json({ id: "discord-user-1", username: "ada", email: "Ada@Example.com" });
    }
    return originalFetch(input, init);
  };
}

beforeEach(async () => {
  installFetchMock();
  await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
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

async function signup(
  fields: Record<string, string>,
  ip = nextIp(),
  headers: HeadersInit = {},
): Promise<Response> {
  return exports.default.fetch(
    workerRequest("https://opengamenode.com/api/waitlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "CF-Connecting-IP": ip,
        "CF-IPCountry": "US",
        ...headers,
      },
      body: formBody({
        ...adultBirth(),
        run_type: "vanilla",
        "cf-turnstile-response": "pass",
        ...fields,
      }),
    }),
  );
}

describe("pages", () => {
  it("serves the homepage and sends referral links to the waitlist", async () => {
    const home = await exports.default.fetch(workerRequest("https://opengamenode.com/"));
    expect(home.status).toBe(200);
    const html = await home.text();
    expect(html).toContain("Free game servers. More time to play.");
    expect(html).toContain("Your game. Your server. Open to everyone.");
    expect(html).toContain('href="/wishlist"');
    expect(html).not.toContain('name="email"');
    expect(html).toContain("NOT AN OFFICIAL MINECRAFT SERVICE");

    const referred = await exports.default.fetch(workerRequest("https://opengamenode.com/?ref=AbC123"));
    expect(referred.status).toBe(302);
    expect(referred.headers.get("Location")).toBe("/wishlist?ref=AbC123");

    const www = await exports.default.fetch(workerRequest("https://www.opengamenode.com/wishlist?ref=AbC123"));
    expect(www.status).toBe(301);
    expect(www.headers.get("Location")).toBe("https://opengamenode.com/wishlist?ref=AbC123");
  });

  it("serves the waitlist, legal pages, and a real 404", async () => {
    const page = await exports.default.fetch(workerRequest("https://opengamenode.com/wishlist?ref=CODE12"));
    const html = await page.text();
    expect(html).toContain("What will you run?");
    expect(html).toContain("Continue with Discord");
    expect(html).toContain('value="CODE12"');
    expect(html).toContain("NOT AN OFFICIAL MINECRAFT SERVICE");
    expect(html).toContain("© 2026 MH Tech Solutions");

    const terms = await exports.default.fetch(workerRequest("https://opengamenode.com/terms"));
    expect(await terms.text()).toContain("placeholder");
    const privacy = await exports.default.fetch(workerRequest("https://opengamenode.com/privacy"));
    expect(await privacy.text()).toContain("placeholder");
    const missing = await exports.default.fetch(workerRequest("https://opengamenode.com/no-such-page"));
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("That page isn&#39;t here.");
  });
});

describe("sign-up", () => {
  it("records a sign-up, rejects a bad token, and returns duplicates", async () => {
    const address = nextEmail();
    const created = await signup({ email: address, discord_username: 'ada, "node"', run_type: "modpack", run_detail: "Create" });
    expect(created.status, await created.clone().text()).toBe(200);
    const body = (await created.json()) as {
      ok: boolean;
      refCode: string;
      referralUrl: string;
      position: number;
      existing: boolean;
      email: string;
    };
    expect(body.ok).toBe(true);
    expect(body.existing).toBe(false);
    expect(body.position).toBeGreaterThan(0);
    expect(body.email).toBe(address);
    expect(body.referralUrl).toBe(`https://opengamenode.com/wishlist?ref=${body.refCode}`);

    const duplicate = await signup({ email: address.toUpperCase() });
    expect(duplicate.status).toBe(200);
    const again = (await duplicate.json()) as { existing: boolean; refCode: string };
    expect(again.existing).toBe(true);
    expect(again.refCode).toBe(body.refCode);

    for (const token of ["", "nope", "wrong-host", "wrong-action"]) {
      const rejected = await signup({ email: nextEmail(), "cf-turnstile-response": token });
      expect(rejected.status).toBe(403);
      const error = (await rejected.json()) as { error: string };
      expect(error.error).toBe("turnstile");
    }

    const testingKey = await signup({ email: nextEmail(), "cf-turnstile-response": "testing" });
    expect(testingKey.status).toBe(200);
  });

  it("blocks under-13 answers and keeps that block on a later answer", async () => {
    const now = new Date();
    const child = await signup({
      email: nextEmail(),
      birth_month: String(now.getUTCMonth() + 1),
      birth_year: String(now.getUTCFullYear() - 13),
    });
    expect(child.status).toBe(403);
    const blocked = (await child.json()) as { message: string };
    expect(blocked.message).toBe("Sorry, you can't join right now.");
    expect(blocked.message).not.toContain("13");
    const cookie = child.headers.getSetCookie().find((value) => value.startsWith("ogn_age_block="));
    expect(cookie).toBeTruthy();

    const later = await signup(
      { email: nextEmail(), ...adultBirth() },
      nextIp(),
      { Cookie: "ogn_age_block=1" },
    );
    expect(later.status).toBe(403);

    const allowedMonth = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth();
    const allowedYear = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 14 : now.getUTCFullYear() - 13;
    const allowed = await signup({
      email: nextEmail(),
      birth_month: String(allowedMonth),
      birth_year: String(allowedYear),
    });
    expect(allowed.status).toBe(200);

    const exported = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/export.csv", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
    );
    const csv = await exported.text();
    expect(csv).not.toContain("birth_");
    expect(csv.split("\r\n")[0]).not.toContain("birth");
  });

  it("moves someone up by the number of friends who use their link", async () => {
    const anchorResponse = await signup({ email: nextEmail() });
    const anchor = (await anchorResponse.json()) as { refCode: string; email: string; position: number };
    await signup({ email: nextEmail(), ref: anchor.refCode });
    await signup({ email: nextEmail(), ref: anchor.refCode.toLowerCase() });
    const ignored = await signup({ email: nextEmail(), ref: "NOPE" });
    expect(ignored.status).toBe(200);

    const revisit = (await (await signup({ email: anchor.email })).json()) as { position: number };
    expect(revisit.position).toBe(Math.max(1, anchor.position - 2));

    const csvResponse = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/export.csv", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
    );
    const csv = await csvResponse.text();
    const anchorRow = csv.split("\r\n").find((line) => line.includes(`,${anchor.refCode},`));
    expect(anchorRow).toBeTruthy();
    const columns = anchorRow?.split(",") ?? [];
    expect(columns[9]).toBe("2");
    const friend = csv.split("\r\n").find((line) => line.includes(`,${anchor.refCode},`) && line !== anchorRow);
    expect(friend).toBeTruthy();
  });

  it("limits new sign-ups from one network to five an hour", async () => {
    const ip = nextIp();
    const first = nextEmail();
    for (let count = 0; count < 5; count += 1) {
      const response = await signup({ email: count === 0 ? first : nextEmail() }, ip);
      expect(response.status, await response.clone().text()).toBe(200);
    }
    const blocked = await signup({ email: nextEmail() }, ip);
    expect(blocked.status).toBe(429);
    const duplicate = await signup({ email: first }, ip);
    expect(duplicate.status).toBe(200);
    const body = (await duplicate.json()) as { existing: boolean };
    expect(body.existing).toBe(true);
  });

  it("exports the csv only with the admin token", async () => {
    const address = nextEmail();
    const ip = "198.51.100.20";
    await signup({ email: address, discord_username: 'sam, "og"' }, ip);
    const missing = await exports.default.fetch(workerRequest("https://opengamenode.com/api/admin/export.csv"));
    expect(missing.status).toBe(401);
    const wrong = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/export.csv", {
        headers: { Authorization: "Bearer wrong-token" },
      }),
    );
    expect(wrong.status).toBe(401);
    const ok = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/admin/export.csv", {
        headers: { Authorization: "Bearer test-admin-token" },
      }),
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("Content-Type")).toContain("text/csv");
    const csv = await ok.text();
    expect(csv).toContain(address);
    expect(csv).toContain('"sam, ""og"""');
    expect(csv).not.toContain(ip);
    expect(csv.split("\r\n")[0]).toBe(
      "id,email,discord_id,discord_username,run_type,run_detail,is_13_plus,ref_code,referred_by,referral_count,ip_hash,country,created_at,invited_at,wave",
    );
  });

  it("finishes Discord sign-in when the client is configured", async () => {
    const start = await exports.default.fetch(
      workerRequest("https://opengamenode.com/api/auth/discord", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "CF-Connecting-IP": nextIp() },
        body: formBody({
          ...adultBirth(),
          run_type: "plugins",
          ref: "FRIEND1",
          "cf-turnstile-response": "pass",
        }),
      }),
    );
    expect(start.status, start.headers.get("Location") ?? "").toBe(302);
    const location = new URL(start.headers.get("Location") ?? "");
    expect(location.hostname).toBe("discord.com");
    expect(location.searchParams.get("scope")).toBe("identify email");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://opengamenode.com/api/auth/discord/callback",
    );
    const cookies = start.headers.getSetCookie();
    const callback = await exports.default.fetch(
      workerRequest(
        `https://opengamenode.com/api/auth/discord/callback?code=auth-code&state=${location.searchParams.get("state")}`,
        { headers: { Cookie: cookies.map((cookie) => cookie.split(";")[0]).join("; ") } },
      ),
    );
    expect(callback.status).toBe(303);
    expect(callback.headers.get("Location")).toMatch(/^\/wishlist\?welcome=/);

    const page = await exports.default.fetch(
      workerRequest(`https://opengamenode.com${callback.headers.get("Location")}`),
    );
    const html = await page.text();
    expect(html).toContain("You&#39;re on the list.");
    expect(html).toContain("ada@example.com");
  });

  it("accepts Cloudflare's published dummy token", async () => {
    globalThis.fetch = originalFetch;
    const response = await signup({
      email: nextEmail(),
      "cf-turnstile-response": "XXXX.DUMMY.TOKEN.XXXX",
    });
    expect(response.status, await response.clone().text()).toBe(200);
  });
});
