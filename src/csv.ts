import type { WaitlistRow } from "./signup";

const COLUMNS = [
  "id",
  "email",
  "discord_id",
  "discord_username",
  "run_type",
  "run_detail",
  "ref_code",
  "referred_by",
  "referral_count",
  "ip_hash",
  "country",
  "created_at",
  "invited_at",
  "wave",
] as const;

function cell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function exportCsv(db: D1Database): Promise<string> {
  const { results } = await db
    .prepare(
      `SELECT id, email, discord_id, discord_username, run_type, run_detail,
              ref_code, referred_by, referral_count, ip_hash, country, created_at, invited_at, wave
       FROM waitlist
       ORDER BY id`,
    )
    .all<WaitlistRow>();
  const lines = [COLUMNS.join(",")];
  for (const row of results) {
    lines.push(COLUMNS.map((column) => cell(row[column])).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
