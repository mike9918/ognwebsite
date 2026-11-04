import {
  CalagopusError,
  createPanelClient,
  type CalagopusEgg,
  type CalagopusEggVariable,
  type CalagopusUser,
  type PanelClient,
} from "./calagopus";
import { content, type RunType } from "./content";
import { cleanText } from "./http";
import { notifyConfigured, sendDiscordReady, sendReadyEmail } from "./notify";
import { planFor, type ServerPlan } from "./plans";
import type { WaitlistRow } from "./signup";

const STALE_CLAIM_MS = 5 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProvisionConfig = {
  baseUrl: string;
  apiKey: string;
  nestUuid: string;
  eggs: Partial<Record<RunType, string>>;
  nodeUuid: string | null;
  locationUuids: string[];
  // The panel's Discord OAuth provider. When set, every provisioned user is
  // linked to their Discord id so their first sign-in lands in that account.
  discordProviderUuid: string | null;
  panelUrl: string;
};

export type ProvisionOutcome =
  | { state: "done"; serverUuid: string; already: boolean }
  | { state: "failed"; message: string }
  | { state: "busy" }
  | { state: "missing" }
  | { state: "unconfigured" };

function httpsOrigin(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function provisionConfig(env: Env): ProvisionConfig | null {
  const baseUrl = httpsOrigin(env.CALAGOPUS_URL);
  const apiKey = (env.CALAGOPUS_API_KEY ?? "").trim();
  const nestUuid = (env.CALAGOPUS_NEST_UUID ?? "").trim();
  if (!baseUrl || !apiKey || !UUID.test(nestUuid)) return null;

  const candidates: Array<[RunType, string | undefined]> = [
    ["vanilla", env.CALAGOPUS_EGG_VANILLA],
    ["plugins", env.CALAGOPUS_EGG_PLUGINS],
    ["modpack", env.CALAGOPUS_EGG_MODPACK],
  ];
  const eggs: Partial<Record<RunType, string>> = {};
  for (const [runType, value] of candidates) {
    const uuid = (value ?? "").trim();
    if (UUID.test(uuid)) eggs[runType] = uuid;
  }
  if (Object.keys(eggs).length === 0) return null;

  const nodeUuid = (env.CALAGOPUS_NODE_UUID ?? "").trim();
  const locationUuids = (env.CALAGOPUS_LOCATION_UUIDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => UUID.test(value));

  const discordProviderUuid = (env.CALAGOPUS_DISCORD_PROVIDER_UUID ?? "").trim();

  return {
    baseUrl,
    apiKey,
    nestUuid,
    eggs,
    nodeUuid: UUID.test(nodeUuid) ? nodeUuid : null,
    locationUuids,
    discordProviderUuid: UUID.test(discordProviderUuid) ? discordProviderUuid : null,
    panelUrl: content.panelUrl,
  };
}

export function provisioningConfigured(env: Env): boolean {
  return provisionConfig(env) !== null && notifyConfigured(env);
}

// Calagopus usernames are 3-15 characters of letters, numbers and underscores.
// The referral code makes the suffix unique and stays inside that budget.
export function panelUsername(row: WaitlistRow): string {
  const base = (row.discord_username ?? "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 6);
  const suffix = (row.ref_code ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  return `${base || "player"}_${suffix}`.slice(0, 15);
}

// Calagopus requires a non-empty last name, but Discord gives us a single
// handle and often no surname at all. Split "ada lovelace" into its parts; a
// one-word handle fills both fields so the panel stays valid without inventing
// a name. Sending an empty name_last is a 400 from POST /api/admin/users.
export function panelNames(row: WaitlistRow): { first: string; last: string } {
  const raw = (row.discord_username ?? "").replace(/[\u0000-\u001f\u007f]/g, " ");
  const words = raw.split(/\s+/).filter(Boolean);
  const first = cleanText(words[0] ?? "", 32) || "Player";
  const last = cleanText(words.slice(1).join(" "), 32) || first;
  return { first, last };
}

export function panelServerName(row: WaitlistRow): string {
  const base = (row.discord_username ?? "")
    .replace(/[^A-Za-z0-9 _.-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (base ? `${base} server` : `Server-${row.id}`).slice(0, 48);
}

export function buildServerPayload(options: {
  ownerUuid: string;
  eggUuid: string;
  externalId: string;
  name: string;
  plan: ServerPlan;
  egg: CalagopusEgg;
  variables: CalagopusEggVariable[];
}): Record<string, unknown> {
  const { plan } = options;
  const images = Array.isArray(options.egg.docker_images)
    ? options.egg.docker_images
    : Object.values(options.egg.docker_images ?? {});
  const startup =
    options.egg.startup ??
    options.egg.startup_commands?.Default ??
    Object.values(options.egg.startup_commands ?? {})[0] ??
    "";
  return {
    owner_uuid: options.ownerUuid,
    egg_uuid: options.eggUuid,
    external_id: options.externalId,
    name: options.name,
    start_on_completion: false,
    skip_installer: false,
    limits: {
      cpu: plan.cpuPercent,
      memory: plan.memoryMiB,
      memory_overhead: 0,
      swap: plan.swapMiB,
      disk: plan.diskMiB,
    },
    pinned_cpus: [],
    startup,
    image: images[0] ?? "",
    hugepages_passthrough_enabled: false,
    kvm_passthrough_enabled: false,
    feature_limits: {
      allocations: plan.allocations,
      databases: plan.databases,
      backups: plan.backups,
      schedules: plan.schedules,
    },
    variables: options.variables
      .filter((variable) => variable.env_variable)
      .map((variable) => ({
        env_variable: variable.env_variable as string,
        value: variable.default_value ?? "",
      })),
  };
}

function externalUserId(id: number): string {
  return `ogn-${id}`;
}

async function savePanelUser(db: D1Database, id: number, uuid: string): Promise<void> {
  await db.prepare("UPDATE waitlist SET calagopus_user_uuid = ? WHERE id = ?").bind(uuid, id).run();
}

async function saveServer(
  db: D1Database,
  id: number,
  uuid: string,
  name: string,
): Promise<void> {
  await db.prepare("UPDATE waitlist SET server_uuid = ?, server_name = ? WHERE id = ?")
    .bind(uuid, name, id)
    .run();
}

async function ensurePanelUser(
  db: D1Database,
  client: PanelClient,
  row: WaitlistRow,
): Promise<CalagopusUser> {
  if (row.calagopus_user_uuid) return { uuid: row.calagopus_user_uuid };
  const externalId = externalUserId(row.id);
  const existing = await client.findUserByExternalId(externalId);
  if (existing) {
    await savePanelUser(db, row.id, existing.uuid);
    return existing;
  }

  const names = panelNames(row);
  try {
    const created = await client.createUser({
      external_id: externalId,
      username: panelUsername(row),
      email: row.email,
      name_first: names.first,
      name_last: names.last,
      admin: false,
      // The panel sends its own account email; ours is the "server is ready"
      // notice, so the two never duplicate the same message.
      send_email: true,
      language: "en",
    });
    await savePanelUser(db, row.id, created.uuid);
    return created;
  } catch (error) {
    if (!(error instanceof CalagopusError) || error.status !== 409) throw error;
    // The Discord email is verified, so a panel account with the same address
    // belongs to this person. Never match on username: it is generated.
    const matches = (await client.searchUsers(row.email)).filter(
      (user) => (user.email ?? "").toLowerCase() === row.email.toLowerCase(),
    );
    const match = matches[0];
    if (!match) {
      throw new Error(
        "A Calagopus account already uses this email or username. Link it to the waitlist entry in the panel, then retry.",
      );
    }
    if (match.external_id && match.external_id !== externalId) {
      throw new Error(
        "That email already belongs to a different panel account. Resolve it in Calagopus by hand, then retry.",
      );
    }
    await client.linkExternalId(match.uuid, externalId);
    await savePanelUser(db, row.id, match.uuid);
    return match;
  }
}

async function ensureServer(
  db: D1Database,
  client: PanelClient,
  row: WaitlistRow,
  config: ProvisionConfig,
  ownerUuid: string,
): Promise<{ uuid: string; name: string }> {
  const fallbackName = panelServerName(row);
  if (row.server_uuid) return { uuid: row.server_uuid, name: row.server_name ?? fallbackName };

  const externalId = externalUserId(row.id);
  const existing = await client.getServerByExternalId(externalId);
  if (existing) {
    const name = existing.name ?? fallbackName;
    await saveServer(db, row.id, existing.uuid, name);
    return { uuid: existing.uuid, name };
  }

  const plan = planFor(row.run_type);
  const eggUuid = config.eggs[row.run_type];
  if (!eggUuid) throw new Error(`No Calagopus egg is configured for ${plan.label} servers.`);

  const egg = await client.getEgg(config.nestUuid, eggUuid);
  const variables = await client.getEggVariables(config.nestUuid, eggUuid);
  const payload = buildServerPayload({
    ownerUuid,
    eggUuid,
    externalId,
    name: fallbackName,
    plan,
    egg,
    variables,
  });

  let server;
  if (config.nodeUuid) {
    const allocations = await client.getAvailableAllocations(config.nodeUuid, 1);
    const allocation = allocations[0];
    if (!allocation) throw new Error("No free allocations on the configured Calagopus node.");
    server = await client.createServer({
      ...payload,
      node_uuid: config.nodeUuid,
      allocation_uuid: allocation.uuid,
      allocation_uuids: [],
    });
  } else if (config.locationUuids.length > 0) {
    server = await client.deployServer({
      ...payload,
      deployment: { location_uuids: config.locationUuids, allow_overallocation: false },
    });
  } else {
    throw new Error(
      "Set CALAGOPUS_NODE_UUID or CALAGOPUS_LOCATION_UUIDS so the panel knows where to place the server.",
    );
  }

  const name = server.name ?? fallbackName;
  await saveServer(db, row.id, server.uuid, name);
  return { uuid: server.uuid, name };
}

async function notify(
  env: Env,
  db: D1Database,
  row: WaitlistRow,
  server: { uuid: string; name: string },
  config: ProvisionConfig,
  now: Date,
): Promise<void> {
  const notice = {
    email: row.email,
    discordId: row.discord_id,
    dmConsent: Boolean(row.discord_dm_consent_at),
    serverName: server.name,
    serverUuid: server.uuid,
    plan: planFor(row.run_type),
    panelUrl: config.panelUrl,
    serverUrl: `${config.baseUrl}/server/${server.uuid}`,
    panelSignIn:
      config.discordProviderUuid && row.discord_id ? ("discord" as const) : ("email" as const),
  };

  let dmSent = Boolean(row.dm_sent_at);
  if (!dmSent) {
    const dm = await sendDiscordReady(env, notice);
    if (dm.ok) {
      await db.prepare("UPDATE waitlist SET dm_sent_at = ? WHERE id = ?")
        .bind(now.toISOString(), row.id)
        .run();
      dmSent = true;
    } else {
      console.warn(JSON.stringify({ event: "provision_dm_skipped", id: row.id, reason: dm.reason }));
    }
  }

  if (row.email_sent_at) return;
  const mail = await sendReadyEmail(env, notice);
  if (mail.ok) {
    await db.prepare("UPDATE waitlist SET email_sent_at = ? WHERE id = ?")
      .bind(now.toISOString(), row.id)
      .run();
    return;
  }
  // A delivered DM is an accepted fallback when email was never configured.
  // A configured sender that fails is retryable, and the retry only resends
  // email because the panel user and server are already stored.
  if (dmSent && mail.reason === "email_not_configured") return;
  throw new Error(
    mail.reason === "email_not_configured"
      ? "Server created, but email is not configured and the Discord DM did not go out."
      : `Server created, but the email failed (${mail.reason}). Retry to send it again.`,
  );
}

function messageFor(error: unknown): string {
  const message =
    error instanceof Error && error.message ? error.message : "Provisioning failed.";
  return cleanText(message, 400);
}

export async function provisionEntry(
  env: Env,
  id: number,
  now = new Date(),
): Promise<ProvisionOutcome> {
  if (!Number.isInteger(id) || id < 1) return { state: "missing" };
  const config = provisionConfig(env);
  if (!config || !notifyConfigured(env)) return { state: "unconfigured" };

  const row = await env.DB.prepare("SELECT * FROM waitlist WHERE id = ?")
    .bind(id)
    .first<WaitlistRow>();
  if (!row) return { state: "missing" };
  if (row.provision_state === "done" && row.server_uuid) {
    return { state: "done", serverUuid: row.server_uuid, already: true };
  }

  // Claiming the row is what stops a double click (or two admins) from creating
  // two panel accounts. A claim older than five minutes is treated as abandoned.
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS).toISOString();
  const claim = await env.DB.prepare(
    `UPDATE waitlist
     SET provision_state = 'running', provision_started_at = ?, provision_error = NULL,
         provision_attempts = provision_attempts + 1
     WHERE id = ?
       AND (provision_state IS NULL OR provision_state = 'failed'
            OR (provision_state = 'running'
                AND (provision_started_at IS NULL OR provision_started_at < ?)))`,
  )
    .bind(now.toISOString(), id, staleBefore)
    .run();
  if ((claim.meta.changes ?? 0) === 0) return { state: "busy" };

  let step = "panel_user";
  try {
    const client = createPanelClient(config);
    const user = await ensurePanelUser(env.DB, client, row);

    // A Discord sign-in with no existing link either creates a second panel
    // account or fails with user_already_exists, so the link has to exist
    // before the user ever visits the panel. Required when a provider is
    // configured: a DM promising Discord sign-in must not be a lie.
    step = "panel_link";
    if (config.discordProviderUuid && row.discord_id) {
      try {
        await client.linkOauth(user.uuid, config.discordProviderUuid, row.discord_id);
      } catch (error) {
        // The panel guards identity links hard, and its own message is opaque.
        if (error instanceof CalagopusError && error.status === 403) {
          throw new Error(
            "Calagopus refused to link Discord (HTTP 403). A panel admin has to enable API linkable on the Discord provider and give the API key the users.impersonate permission, then retry.",
          );
        }
        throw error;
      }
    }

    step = "server";
    const server = await ensureServer(env.DB, client, row, config, user.uuid);

    step = "notification";
    await notify(env, env.DB, row, server, config, now);

    const doneAt = now.toISOString();
    await env.DB.prepare(
      `UPDATE waitlist
       SET provision_state = 'done', provisioned_at = ?, invited_at = COALESCE(invited_at, ?),
           provision_error = NULL, provision_started_at = NULL,
           calagopus_user_uuid = ?, server_uuid = ?, server_name = ?
       WHERE id = ?`,
    )
      .bind(doneAt, doneAt, user.uuid, server.uuid, server.name, id)
      .run();
    console.log(JSON.stringify({ event: "provision_done", id }));
    return { state: "done", serverUuid: server.uuid, already: false };
  } catch (error) {
    const message = messageFor(error);
    await env.DB.prepare(
      "UPDATE waitlist SET provision_state = 'failed', provision_error = ?, provision_started_at = NULL WHERE id = ?",
    )
      .bind(message, id)
      .run();
    // Only structured, PII-free fields: panel errors can echo an email address.
    console.error(
      JSON.stringify({
        event: "provision_failed",
        id,
        step,
        status: error instanceof CalagopusError ? error.status : null,
      }),
    );
    return { state: "failed", message };
  }
}
