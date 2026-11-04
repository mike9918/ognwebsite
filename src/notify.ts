import { content } from "./content";
import { emailConfigured, sendEmail } from "./email";
import { escapeHtml } from "./http";
import { describePlan, type ServerPlan } from "./plans";

export type NotificationOutcome = { ok: true } | { ok: false; reason: string };

export type ReadyNotice = {
  email: string;
  discordId: string | null;
  dmConsent: boolean;
  serverName: string;
  serverUuid: string;
  plan: ServerPlan;
  panelUrl: string;
  serverUrl: string;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export function notifyConfigured(env: Env): boolean {
  const discord = Boolean(env.DISCORD_BOT_TOKEN) && /^\d{5,30}$/.test(env.DISCORD_GUILD_ID ?? "");
  return discord || emailConfigured(env);
}

export function dmMessage(notice: ReadyNotice): string {
  const { labels, dmIntro, dmNote } = content.provision;
  return [
    dmIntro,
    `${labels.server}: ${notice.serverName}`,
    `${labels.plan}: ${describePlan(notice.plan)}`,
    fill(dmNote, { email: notice.email }),
    notice.panelUrl,
  ].join("\n");
}

function emailText(notice: ReadyNotice): string {
  const { labels, emailIntro, emailNote, closing } = content.provision;
  return [
    emailIntro,
    "",
    `${labels.server}: ${notice.serverName}`,
    `${labels.plan}: ${describePlan(notice.plan)}`,
    `${labels.panel}: ${notice.panelUrl}`,
    `${labels.email}: ${notice.email}`,
    "",
    fill(emailNote, { email: notice.email }),
    notice.serverUrl,
    "",
    closing,
  ].join("\n");
}

function emailHtml(notice: ReadyNotice): string {
  const { labels, emailIntro, emailNote, closing } = content.provision;
  const rows: Array<[string, string]> = [
    [labels.server, notice.serverName],
    [labels.plan, describePlan(notice.plan)],
    [labels.email, notice.email],
  ];
  const cells = rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="color:#5b6b62;font-weight:600;padding:2px 16px 2px 0">${escapeHtml(label)}</th><td style="padding:2px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:24px;background:#f4f7f5;color:#0d1712;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
  <table role="presentation" width="100%" style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:12px">
    <tr><td style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px">${escapeHtml(emailIntro)}</h1>
      <table role="presentation" style="font-size:14px;line-height:1.6">${cells}</table>
      <p style="margin:20px 0"><a href="${escapeHtml(notice.panelUrl)}" style="background:#0d1712;color:#ffffff;padding:10px 18px;border-radius:999px;text-decoration:none">Open the panel</a></p>
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6">${escapeHtml(fill(emailNote, { email: notice.email }))}</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6"><a href="${escapeHtml(notice.serverUrl)}">${escapeHtml(notice.serverUrl)}</a></p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:#5b6b62">${escapeHtml(closing)}</p>
    </td></tr>
  </table>
</body></html>`;
}

// The DM is only attempted for members who completed the join/consent flow.
// Membership is rechecked because a stored id does not prove the account is
// still in the guild, and Discord refuses DMs from non-members.
export async function sendDiscordReady(env: Env, notice: ReadyNotice): Promise<NotificationOutcome> {
  if (!notice.discordId || !notice.dmConsent) return { ok: false, reason: "no_consent" };
  if (!env.DISCORD_BOT_TOKEN || !/^\d{5,30}$/.test(env.DISCORD_GUILD_ID ?? "")) {
    return { ok: false, reason: "discord_not_configured" };
  }
  const authorization = `Bot ${env.DISCORD_BOT_TOKEN}`;
  try {
    const member = await fetch(
      `https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/members/${notice.discordId}`,
      { headers: { Authorization: authorization }, signal: AbortSignal.timeout(10_000) },
    );
    if (member.status === 404) return { ok: false, reason: "not_a_member" };
    if (!member.ok) return { ok: false, reason: `membership_http_${member.status}` };

    const channel = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: notice.discordId }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!channel.ok) return { ok: false, reason: `channel_http_${channel.status}` };
    const channelJson = (await channel.json()) as { id?: string };
    if (!channelJson.id) return { ok: false, reason: "channel_missing_id" };

    const message = await fetch(`https://discord.com/api/v10/channels/${channelJson.id}/messages`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ content: dmMessage(notice) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!message.ok) return { ok: false, reason: `message_http_${message.status}` };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network_or_timeout" };
  }
}

// The provider is chosen in ./email: Microsoft 365 when its app credentials are
// set, otherwise Resend. Only the HTTP status is logged, never the message.
export async function sendReadyEmail(env: Env, notice: ReadyNotice): Promise<NotificationOutcome> {
  return sendEmail(env, {
    to: notice.email,
    subject: content.provision.emailSubject,
    text: emailText(notice),
    html: emailHtml(notice),
  });
}
