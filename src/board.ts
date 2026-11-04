import { content } from "./content";
import { describePlan, planFor } from "./plans";
import { positionFor, type WaitlistRow } from "./signup";

// The "new waitlist entry" card lives in the ops channel. It is posted once,
// when the person completes the Discord signup, and edited in place when
// provisioning finishes, so the channel reads as one line per person instead of
// an arrival post plus a separate "done" post.
const API = "https://discord.com/api/v10";

export type CardProvision = {
  serverName: string;
  panelUser: string;
  serverUrl: string;
};

function botConfigured(env: Env): boolean {
  return Boolean(env.DISCORD_BOT_TOKEN) && /^\d{5,30}$/.test(env.DISCORD_GUILD_ID ?? "");
}

function asChannelId(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  return /^\d{5,30}$/.test(value) ? value : null;
}

// Lowercase and drop separators so "waitlist" and "wait-list" both match.
function channelName(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

let channelCache: { guild: string; id: string } | null = null;

// DISCORD_WAITLIST_CHANNEL_ID wins. Without it the channel is found by name
// once per isolate, so the card works without another setting to keep in sync.
async function resolveChannel(env: Env): Promise<string | null> {
  const explicit = asChannelId(env.DISCORD_WAITLIST_CHANNEL_ID);
  if (explicit) return explicit;
  const guild = env.DISCORD_GUILD_ID ?? "";
  if (channelCache?.guild === guild) return channelCache.id;
  try {
    const response = await fetch(`${API}/guilds/${guild}/channels`, {
      headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const channels = (await response.json()) as Array<{
      id?: string;
      name?: string;
      type?: number;
    }>;
    const match = channels.find(
      (channel) =>
        typeof channel.id === "string" &&
        typeof channel.name === "string" &&
        // Text and announcement channels only; a voice channel named "waitlist"
        // cannot take a message.
        (channel.type === 0 || channel.type === 5) &&
        channelName(channel.name) === "waitlist",
    );
    if (!match?.id) return null;
    channelCache = { guild, id: match.id };
    return match.id;
  } catch {
    return null;
  }
}

// Handles and modpack names come from visitors, so they go in code spans with
// backticks and newlines removed rather than being pasted as markdown.
function code(value: string): string {
  return `\`${value.replace(/[`\n\r]/g, "").trim()}\``;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function waitlistCard(
  row: WaitlistRow,
  position: number,
  provision: CardProvision | null,
): string {
  const { labels, heading, headingProvisioned, notLinked } = content.board;
  const lines = [
    fill(provision ? headingProvisioned : heading, { place: String(position) }),
    `${labels.discord}: ${code(row.discord_username ?? notLinked)} (${
      row.discord_id ? code(row.discord_id) : notLinked
    })`,
    `${labels.email}: ${code(row.email)}`,
    `${labels.plan}: ${describePlan(planFor(row.run_type))}`,
  ];
  if (row.run_detail) lines.push(`${labels.wants}: ${code(row.run_detail)}`);
  lines.push(`${labels.ref}: ${code(row.ref_code)}`);
  const joined = Date.parse(row.created_at);
  if (Number.isFinite(joined)) {
    lines.push(`${labels.joined}: <t:${Math.floor(joined / 1000)}:R>`);
  }
  if (provision) {
    lines.push("");
    lines.push(`${labels.server}: **${provision.serverName}**`);
    lines.push(`${labels.panelUser}: ${code(provision.panelUser)}`);
    lines.push(provision.serverUrl);
  }
  return lines.join("\n");
}

function authorization(env: Env): Record<string, string> {
  return {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Best effort by design: a card is an operations convenience, so a Discord
// hiccup must never turn a completed signup into an error page.
export async function postWaitlistCard(
  env: Env,
  db: D1Database,
  row: WaitlistRow,
): Promise<void> {
  if (!botConfigured(env)) return;
  try {
    const channelId = await resolveChannel(env);
    if (!channelId) {
      console.warn(JSON.stringify({ event: "waitlist_card_skipped", reason: "channel_missing" }));
      return;
    }
    const position = await positionFor(db, row);
    const response = await fetch(`${API}/channels/${channelId}/messages`, {
      method: "POST",
      headers: authorization(env),
      body: JSON.stringify({
        content: waitlistCard(row, position, null),
        // Nothing in a visitor-supplied handle should be able to ping the guild.
        allowed_mentions: { parse: [] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.warn(
        JSON.stringify({ event: "waitlist_card_skipped", reason: `http_${response.status}` }),
      );
      return;
    }
    const message = (await response.json()) as { id?: string };
    if (!message.id) return;
    await db
      .prepare("UPDATE waitlist SET discord_channel_id = ?, discord_message_id = ? WHERE id = ?")
      .bind(channelId, message.id, row.id)
      .run();
  } catch {
    console.warn(JSON.stringify({ event: "waitlist_card_skipped", reason: "network_or_timeout" }));
  }
}

export async function updateWaitlistCard(
  env: Env,
  db: D1Database,
  row: WaitlistRow,
  provision: CardProvision,
): Promise<void> {
  if (!botConfigured(env) || !row.discord_channel_id || !row.discord_message_id) return;
  try {
    const position = await positionFor(db, row);
    const response = await fetch(
      `${API}/channels/${row.discord_channel_id}/messages/${row.discord_message_id}`,
      {
        method: "PATCH",
        headers: authorization(env),
        body: JSON.stringify({
          content: waitlistCard(row, position, provision),
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) {
      console.warn(
        JSON.stringify({ event: "waitlist_card_update_skipped", id: row.id, status: response.status }),
      );
    }
  } catch {
    console.warn(
      JSON.stringify({ event: "waitlist_card_update_skipped", id: row.id, reason: "network_or_timeout" }),
    );
  }
}
