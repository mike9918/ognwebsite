import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { claimIsStale, panelNames, STALE_CLAIM_MS } from "../src/provision";
import { sweepSignups } from "../src/sweep";
import type { WaitlistRow } from "../src/signup";

type TestEnv = Env & { TEST_MIGRATIONS: D1Migration[] };

const PANEL = "https://panel.test";
const NEST = "11111111-1111-4111-8111-111111111111";
const EGG_MODPACK = "22222222-2222-4222-8222-222222222222";
const EGG_VANILLA = "33333333-3333-4333-8333-333333333333";
const USER_UUID = "44444444-4444-4444-8444-444444444444";
const SERVER_UUID = "55555555-5555-4555-8555-555555555555";
const DISCORD_ID = "333444555666777888";
const DISCORD_PROVIDER = "88888888-8888-4888-8888-888888888888";

const originalFetch = globalThis.fetch;

type PanelUser = { uuid: string; email?: string; external_id?: string | null };
let panelUser: PanelUser | null = null;
let createdUsers: Array<Record<string, unknown>> = [];
let createdServers: Array<Record<string, unknown>> = [];
let serverDeployCalls = 0;
let serverDeployStatus = 200;
let dmChannelStatus = 200;
let dmMessages: string[] = [];
let cardUpdates: string[] = [];
let emails: Array<Record<string, unknown>> = [];
let oauthLinks: Array<Record<string, unknown>> = [];
let linkStatus = 200;
let linkOwner: string | null = USER_UUID;

function installFetchMock(): void {
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";

    if (url === "https://discord.com/api/oauth2/token") {
      return Response.json({ access_token: "access-token", scope: "identify" });
    }
    if (url === "https://discord.com/api/users/@me") {
      return Response.json({ id: "111222333444555666", username: "michael" });
    }
    if (url === `https://discord.com/api/v10/guilds/123456789012345678/members/${DISCORD_ID}`) {
      return Response.json({ user: { id: DISCORD_ID } });
    }
    if (url === "https://discord.com/api/v10/users/@me/channels") {
      if (dmChannelStatus !== 200) return Response.json({ message: "denied" }, { status: dmChannelStatus });
      return Response.json({ id: "999000111222333444" });
    }
    if (url === "https://discord.com/api/v10/channels/999000111222333444/messages") {
      dmMessages.push(String(JSON.parse(String(init?.body)).content));
      return Response.json({ id: "msg" });
    }
    if (
      url === "https://discord.com/api/v10/channels/555000111222333444/messages/card-1" &&
      method === "PATCH"
    ) {
      cardUpdates.push(
        String((JSON.parse(String(init?.body)) as { content: string }).content),
      );
      return Response.json({ id: "card-1" });
    }
    if (url === "https://api.resend.com/emails") {
      emails.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return Response.json({ id: "email" });
    }

    if (url.startsWith(`${PANEL}/api/admin/users/external/`)) {
      if (!panelUser) return Response.json({ errors: [{ detail: "Not found" }] }, { status: 404 });
      return Response.json({ user: panelUser });
    }
    if (url === `${PANEL}/api/admin/users` && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      createdUsers.push(body);
      panelUser = { uuid: USER_UUID, email: String(body.email), external_id: String(body.external_id) };
      return Response.json({ user: panelUser });
    }
    if (
      url ===
        `${PANEL}/api/admin/oauth-providers/${DISCORD_PROVIDER}/users/identifier/${DISCORD_ID}` &&
      method === "GET"
    ) {
      if (!linkOwner) {
        return Response.json({ errors: [{ detail: "Not found" }] }, { status: 404 });
      }
      return Response.json({
        user_oauth_link: { uuid: "link", user: { uuid: linkOwner }, identifier: DISCORD_ID },
      });
    }
    if (url === `${PANEL}/api/admin/users/${USER_UUID}/oauth-links` && method === "POST") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      oauthLinks.push(body);
      if (linkStatus !== 200) {
        return Response.json({ errors: [{ detail: "link failed" }] }, { status: linkStatus });
      }
      return Response.json({ oauth_link: { identifier: body.identifier } });
    }
    const eggPath = `${PANEL}/api/admin/nests/${NEST}/eggs/`;
    if (url.startsWith(eggPath)) {
      const [eggUuid, extra] = url.slice(eggPath.length).split("/");
      if (eggUuid && !extra) {
        return Response.json({
          egg: {
            uuid: eggUuid,
            docker_images: { java: "ghcr.io/example/java:21" },
            startup: "java -jar server.jar",
          },
        });
      }
      if (eggUuid && extra === "variables") {
        return Response.json({
          variables: [
            { env_variable: "MEMORY", default_value: "2048" },
            { env_variable: "SERVER_JARFILE", default_value: "server.jar" },
            { env_variable: "EULA", default_value: "false" },
          ],
        });
      }
    }
    if (url.startsWith(`${PANEL}/api/admin/servers/external/`)) {
      return Response.json({ errors: [{ detail: "Not found" }] }, { status: 404 });
    }
    if (url === `${PANEL}/api/admin/servers/deploy` && method === "POST") {
      serverDeployCalls += 1;
      if (serverDeployStatus !== 200) {
        return Response.json({ errors: [{ detail: "deploy failed" }] }, { status: serverDeployStatus });
      }
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      createdServers.push(body);
      return Response.json({ server: { uuid: SERVER_UUID, name: body.name } });
    }
    return originalFetch(input, init);
  };
}

async function insertEntry(runType = "modpack"): Promise<number> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO waitlist (email, discord_id, discord_username, run_type, run_detail,
       ref_code, ip_hash, country, created_at, discord_joined_at, discord_dm_consent_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'hash', 'US', ?, ?, ?)`,
  )
    .bind("ada@example.com", DISCORD_ID, "ada", runType, "AB12CD34", now, now, now)
    .run();
  const row = await env.DB.prepare("SELECT id FROM waitlist ORDER BY id DESC LIMIT 1")
    .first<{ id: number }>();
  return row!.id;
}

async function adminCookie(): Promise<string> {
  const start = await exports.default.fetch(
    new Request("https://opengamenode.com/api/auth/admin/discord", { redirect: "manual" }),
  );
  expect(start.status).toBe(302);
  const location = new URL(start.headers.get("Location") ?? "");
  const cookies = start.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  const callback = await exports.default.fetch(
    new Request(
      `https://opengamenode.com/api/auth/admin/discord/callback?code=admin&state=${location.searchParams.get("state")}`,
      { headers: { Cookie: cookies }, redirect: "manual" },
    ),
  );
  expect(callback.headers.get("Location")).toBe("/admin");
  return callback.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .filter((cookie) => cookie.startsWith("ogn_admin_session="))
    .join("; ");
}

async function provision(id: number, cookie = ""): Promise<Response> {
  return exports.default.fetch(
    new Request("https://opengamenode.com/api/admin/entries/provision", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: cookie } : {}) },
      body: new URLSearchParams({ id: String(id) }).toString(),
      redirect: "manual",
    }),
  );
}

beforeEach(async () => {
  panelUser = null;
  createdUsers = [];
  createdServers = [];
  serverDeployCalls = 0;
  serverDeployStatus = 200;
  dmChannelStatus = 200;
  dmMessages = [];
  cardUpdates = [];
  emails = [];
  oauthLinks = [];
  linkStatus = 200;
  linkOwner = USER_UUID;
  installFetchMock();
  await applyD1Migrations(env.DB, (env as TestEnv).TEST_MIGRATIONS);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM waitlist"),
    env.DB.prepare("DELETE FROM signup_attempts"),
  ]);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("provisioning", () => {
  it("splits a Discord handle into names, never leaving the surname empty", () => {
    const names = (value: string) => panelNames({ discord_username: value } as WaitlistRow);
    expect(names("Ada Lovelace")).toEqual({ first: "Ada", last: "Lovelace" });
    expect(names("ada")).toEqual({ first: "ada", last: "ada" });
    expect(names("")).toEqual({ first: "Player", last: "Player" });
    expect(names("   ")).toEqual({ first: "Player", last: "Player" });
  });

  it("requires an admin session", async () => {
    const id = await insertEntry();
    const response = await provision(id);
    expect(response.headers.get("Location")).toBe("/admin?error=forbidden");
    expect(createdUsers).toHaveLength(0);
    expect(serverDeployCalls).toBe(0);
  });

  it("creates the panel account, applies the modpack plan, DMs and emails the user", async () => {
    const id = await insertEntry("modpack");
    const response = await provision(id, await adminCookie());
    expect(response.headers.get("Location")).toBe("/admin?provisioned=1");

    expect(createdUsers).toHaveLength(1);
    expect(createdUsers[0]).toMatchObject({
      external_id: `ogn-${id}`,
      email: "ada@example.com",
      username: "ada_ab12cd34",
      name_first: "ada",
      // Calagopus rejects an empty surname with HTTP 400, so it is never blank.
      name_last: "ada",
      admin: false,
      send_email: true,
    });
    // The panel only signs someone into this account if the Discord link
    // exists before their first sign-in.
    expect(oauthLinks).toEqual([
      { oauth_provider_uuid: DISCORD_PROVIDER, identifier: DISCORD_ID },
    ]);

    expect(createdServers).toHaveLength(1);
    const server = createdServers[0] as {
      owner_uuid: string;
      external_id: string;
      name: string;
      limits: Record<string, number>;
      feature_limits: Record<string, number>;
      variables: Array<{ env_variable: string; value: string }>;
      deployment: { location_uuids: string[]; allow_overallocation: boolean };
    };
    expect(server.owner_uuid).toBe(USER_UUID);
    expect(server.external_id).toBe(`ogn-${id}`);
    expect(server.name).toBe("ada server");
    expect(server.limits).toMatchObject({ memory: 3072, disk: 10240, cpu: 300, swap: 0 });
    expect(server.feature_limits).toMatchObject({ allocations: 1, databases: 0, backups: 1, schedules: 1 });
    expect(server.variables).toEqual([
      { env_variable: "MEMORY", value: "2048" },
      { env_variable: "SERVER_JARFILE", value: "server.jar" },
      // Every other variable keeps the egg default; EULA is accepted so the
      // installer and first start can run.
      { env_variable: "EULA", value: "true" },
    ]);
    expect(server.deployment).toEqual({
      location_uuids: ["66666666-6666-4666-8666-666666666666"],
      allow_overallocation: false,
    });

    expect(dmMessages).toHaveLength(1);
    expect(dmMessages[0]).toContain("ada server");
    expect(dmMessages[0]).toContain("3 GB RAM · Modpack");
    expect(dmMessages[0]).toContain("Sign in at https://panel.opengamenode.com with Discord");

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: ["ada@example.com"],
      subject: "Your OpenGameNode server is ready",
    });

    const row = await env.DB.prepare(
      `SELECT provision_state, provision_error, server_uuid, calagopus_user_uuid,
              dm_sent_at, email_sent_at, provisioned_at, invited_at
       FROM waitlist WHERE id = ?`,
    )
      .bind(id)
      .first<Record<string, string | null>>();
    expect(row).toMatchObject({
      provision_state: "done",
      provision_error: null,
      server_uuid: SERVER_UUID,
      calagopus_user_uuid: USER_UUID,
    });
    expect(row?.dm_sent_at).toBeTruthy();
    expect(row?.email_sent_at).toBeTruthy();
    expect(row?.provisioned_at).toBeTruthy();
    expect(row?.invited_at).toBeTruthy();

    // Pressing Provision again is a no-op, not a second account or server.
    const again = await provision(id, await adminCookie());
    expect(again.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(createdUsers).toHaveLength(1);
    expect(serverDeployCalls).toBe(1);
    expect(emails).toHaveLength(1);
  });

  it("resumes after a failed server deploy without duplicating the panel account", async () => {
    const id = await insertEntry("vanilla");
    const cookie = await adminCookie();

    serverDeployStatus = 500;
    const failed = await provision(id, cookie);
    expect(failed.headers.get("Location")).toBe("/admin?provision=failed");

    const page = await exports.default.fetch(
      new Request("https://opengamenode.com/admin?provision=failed", {
        headers: { Cookie: cookie },
        redirect: "manual",
      }),
    );
    const html = await page.text();
    expect(html).toContain("Provisioning failed");
    expect(html).toContain("Retry provision");

    let row = await env.DB.prepare(
      "SELECT provision_state, provision_error, calagopus_user_uuid FROM waitlist WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string | null>>();
    expect(row?.provision_state).toBe("failed");
    expect(row?.provision_error).toContain("HTTP 500");
    expect(row?.calagopus_user_uuid).toBe(USER_UUID);

    serverDeployStatus = 200;
    const retried = await provision(id, cookie);
    expect(retried.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(createdUsers).toHaveLength(1);
    expect(serverDeployCalls).toBe(2);
    expect(emails).toHaveLength(1);

    row = await env.DB.prepare(
      "SELECT provision_state, provision_error, provision_attempts FROM waitlist WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string | number | null>>();
    expect(row?.provision_state).toBe("done");
    expect(row?.provision_error).toBeNull();
    expect(row?.provision_attempts).toBe(2);
  });

  it("falls back to email when the user's Discord DMs are closed", async () => {
    const id = await insertEntry("vanilla");
    dmChannelStatus = 403;
    const response = await provision(id, await adminCookie());
    expect(response.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(dmMessages).toHaveLength(0);
    expect(emails).toHaveLength(1);

    const row = await env.DB.prepare("SELECT dm_sent_at, email_sent_at FROM waitlist WHERE id = ?")
      .bind(id)
      .first<Record<string, string | null>>();
    expect(row?.dm_sent_at).toBeNull();
    expect(row?.email_sent_at).toBeTruthy();
  });

  it("treats an existing Discord link as success", async () => {
    const id = await insertEntry("vanilla");
    linkStatus = 409;
    const response = await provision(id, await adminCookie());
    expect(response.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(createdServers).toHaveLength(1);
  });

  it("refuses a Discord identity that another panel account already owns", async () => {
    const id = await insertEntry("vanilla");
    linkStatus = 409;
    linkOwner = "99999999-9999-4999-8999-999999999999";

    const response = await provision(id, await adminCookie());
    expect(response.headers.get("Location")).toBe("/admin?provision=failed");
    expect(serverDeployCalls).toBe(0);

    const row = await env.DB.prepare(
      "SELECT provision_state, provision_error FROM waitlist WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string | null>>();
    expect(row?.provision_state).toBe("failed");
    expect(row?.provision_error).toContain("already linked to a different panel account");
    expect(row?.provision_error).toContain(linkOwner);
  });

  it("stops before creating a server when the panel refuses the Discord link", async () => {
    const id = await insertEntry("vanilla");
    const cookie = await adminCookie();
    linkStatus = 403;

    const failed = await provision(id, cookie);
    expect(failed.headers.get("Location")).toBe("/admin?provision=failed");
    expect(serverDeployCalls).toBe(0);

    const row = await env.DB.prepare(
      "SELECT provision_state, provision_error, calagopus_user_uuid FROM waitlist WHERE id = ?",
    )
      .bind(id)
      .first<Record<string, string | null>>();
    expect(row?.provision_state).toBe("failed");
    expect(row?.provision_error).toContain("HTTP 403");
    // The panel's guard message is opaque; the row names the two switches.
    expect(row?.provision_error).toContain("API linkable");
    expect(row?.provision_error).toContain("users.impersonate");
    expect(row?.calagopus_user_uuid).toBe(USER_UUID);

    // Fixing the panel permissions and retrying resumes at the link step.
    linkStatus = 200;
    const retried = await provision(id, cookie);
    expect(retried.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(createdUsers).toHaveLength(1);
    expect(oauthLinks).toHaveLength(2);
    expect(serverDeployCalls).toBe(1);
  });

  it("marks the waitlist card as provisioned instead of posting another", async () => {
    const id = await insertEntry("vanilla");
    await env.DB.prepare(
      "UPDATE waitlist SET discord_channel_id = ?, discord_message_id = ? WHERE id = ?",
    )
      .bind("555000111222333444", "card-1", id)
      .run();

    const response = await provision(id, await adminCookie());
    expect(response.headers.get("Location")).toBe("/admin?provisioned=1");
    expect(cardUpdates).toHaveLength(1);
    expect(cardUpdates[0]).toContain("✅ Provisioned");
    expect(cardUpdates[0]).toContain("ada server");
    expect(cardUpdates[0]).toContain("ada_ab12cd34");
    expect(cardUpdates[0]).toContain(`/server/${SERVER_UUID}`);
    // The card still carries the entry's original details.
    expect(cardUpdates[0]).toContain("ada@example.com");
  });

  it("sweeps a stale running claim left by a crashed waitUntil", async () => {
    const id = await insertEntry("vanilla");
    const staleAt = new Date(Date.now() - STALE_CLAIM_MS - 1_000).toISOString();
    await env.DB.prepare(
      `UPDATE waitlist
       SET provision_state = 'running', provision_started_at = ?, provision_attempts = 1
       WHERE id = ?`,
    )
      .bind(staleAt, id)
      .run();
    await env.DB.prepare("UPDATE waitlist_settings SET auto_provision = 1 WHERE id = 1").run();

    expect(claimIsStale(staleAt)).toBe(true);
    const done = await sweepSignups(env);
    expect(done).toBe(1);

    const row = await env.DB.prepare(
      "SELECT provision_state, server_uuid FROM waitlist WHERE id = ?",
    )
      .bind(id)
      .first<{ provision_state: string; server_uuid: string | null }>();
    expect(row).toEqual({ provision_state: "done", server_uuid: SERVER_UUID });
    expect(createdUsers).toHaveLength(1);
    expect(serverDeployCalls).toBe(1);
  });

  it("leaves a fresh running claim alone and offers admin Retry once stale", async () => {
    const id = await insertEntry("vanilla");
    const freshAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE waitlist
       SET provision_state = 'running', provision_started_at = ?, provision_attempts = 1
       WHERE id = ?`,
    )
      .bind(freshAt, id)
      .run();
    await env.DB.prepare("UPDATE waitlist_settings SET auto_provision = 1 WHERE id = 1").run();

    expect(await sweepSignups(env)).toBe(0);
    expect(createdUsers).toHaveLength(0);

    const cookie = await adminCookie();
    const freshPage = await (
      await exports.default.fetch(
        new Request("https://opengamenode.com/admin", { headers: { Cookie: cookie } }),
      )
    ).text();
    expect(freshPage).toContain("Provisioning…");
    expect(freshPage).not.toContain("Stuck provisioning");

    const staleAt = new Date(Date.now() - STALE_CLAIM_MS - 1_000).toISOString();
    await env.DB.prepare(
      "UPDATE waitlist SET provision_started_at = ? WHERE id = ?",
    )
      .bind(staleAt, id)
      .run();

    const stalePage = await (
      await exports.default.fetch(
        new Request("https://opengamenode.com/admin", { headers: { Cookie: cookie } }),
      )
    ).text();
    expect(stalePage).toContain("Stuck provisioning — safe to retry");
    expect(stalePage).toContain("Retry provision");
  });
});
