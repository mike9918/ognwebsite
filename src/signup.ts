import { RUN_TYPES, type RunType } from "./content";
import { cleanText, sha256Hex } from "./http";
import { OCCUPIED_SQL, signupBlockedReason } from "./settings";

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

export type WaitlistRow = {
  id: number;
  email: string;
  discord_id: string | null;
  discord_username: string | null;
  run_type: RunType;
  run_detail: string | null;
  ref_code: string;
  referred_by: string | null;
  referral_count: number;
  ip_hash: string;
  country: string | null;
  created_at: string;
  invited_at: string | null;
  wave: number | null;
  provision_state: string | null;
  provision_error: string | null;
  server_uuid: string | null;
  server_name: string | null;
  provisioned_at: string | null;
  calagopus_user_uuid: string | null;
  discord_dm_consent_at: string | null;
  dm_sent_at: string | null;
  email_sent_at: string | null;
  discord_channel_id: string | null;
  discord_message_id: string | null;
};

export type SignupInput = {
  email: string;
  discordId: string;
  discordUsername: string | null;
  runType: RunType;
  runDetail: string | null;
  ref: string | null;
  ip: string;
  country: string | null;
  salt: string;
  now: Date;
};

// The public status of a sign-up. Internal provision_error text is never part
// of this, so a public page cannot leak panel details or addresses.
export type SignupStatus = "preparing" | "ready" | "problem";

export type PublicEntry = {
  email: string;
  refCode: string;
  status: SignupStatus;
  existing: boolean;
};

export function statusFor(provisionState: string | null): SignupStatus {
  if (provisionState === "done") return "ready";
  if (provisionState === "failed") return "problem";
  return "preparing";
}

export function normalizeEmail(value: string): string | null {
  const email = cleanText(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeRunType(value: string): RunType | null {
  return RUN_TYPES.includes(value as RunType) ? (value as RunType) : null;
}

export function normalizeRef(value: string): string | null {
  const ref = cleanText(value, 16).toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(ref) ? ref : null;
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${ip}`);
}

function refCode(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => REF_ALPHABET[byte % REF_ALPHABET.length]).join("");
}

async function findByEmail(db: D1Database, email: string): Promise<WaitlistRow | null> {
  return db
    .prepare("SELECT * FROM waitlist WHERE email = ?")
    .bind(email)
    .first<WaitlistRow>();
}

async function findByDiscord(db: D1Database, discordId: string): Promise<WaitlistRow | null> {
  return db
    .prepare("SELECT * FROM waitlist WHERE discord_id = ?")
    .bind(discordId)
    .first<WaitlistRow>();
}

export async function findByRef(db: D1Database, refCodeValue: string): Promise<WaitlistRow | null> {
  return db
    .prepare("SELECT * FROM waitlist WHERE ref_code = ?")
    .bind(refCodeValue)
    .first<WaitlistRow>();
}

async function recentAttempts(db: D1Database, ipHash: string, now: Date): Promise<number> {
  const cutoff = new Date(now.getTime() - RATE_WINDOW_MS).toISOString();
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM signup_attempts WHERE ip_hash = ? AND created_at > ?",
    )
    .bind(ipHash, cutoff)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

// One statement, so the cap cannot be overshot by two sign-ups racing. The
// WHERE clause reads the same settings row the admin form writes, and the
// second half counts only rows that actually hold a free slot. A refused
// insert changes zero rows instead of creating an over-cap row.
const INSERT_SQL = `
  INSERT INTO waitlist (
    email, discord_id, discord_username, run_type, run_detail,
    ref_code, referred_by, ip_hash, country, created_at, provision_state
  )
  SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued'
  WHERE (SELECT is_open FROM waitlist_settings WHERE id = 1) = 1
    AND (
      (SELECT signup_cap FROM waitlist_settings WHERE id = 1) IS NULL
      OR (SELECT COUNT(*) FROM waitlist WHERE ${OCCUPIED_SQL})
         < (SELECT signup_cap FROM waitlist_settings WHERE id = 1)
    )`;

export async function createSignup(
  db: D1Database,
  input: SignupInput,
): Promise<
  | { ok: true; row: WaitlistRow; existing: boolean }
  | { ok: false; error: "rate" | "closed" | "full" }
> {
  const ipHash = await hashIp(input.ip, input.salt);
  const byDiscord = await findByDiscord(db, input.discordId);
  if (byDiscord) return { ok: true, row: byDiscord, existing: true };
  const byEmail = await findByEmail(db, input.email);
  if (byEmail) return { ok: true, row: byEmail, existing: true };

  // Fast, friendly failure before the insert. The insert below is what actually
  // enforces the cap.
  const blocked = await signupBlockedReason(db);
  if (blocked) return { ok: false, error: blocked };

  if ((await recentAttempts(db, ipHash, input.now)) >= RATE_LIMIT) {
    return { ok: false, error: "rate" };
  }

  const referredBy = input.ref ? await findByRef(db, input.ref) : null;
  const createdAt = input.now.toISOString();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = refCode();
    let inserted;
    try {
      inserted = await db
        .prepare(INSERT_SQL)
        .bind(
          input.email,
          input.discordId,
          input.discordUsername,
          input.runType,
          input.runDetail,
          code,
          referredBy ? referredBy.ref_code : null,
          ipHash,
          input.country,
          createdAt,
        )
        .run();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("waitlist.email")) {
        const existing = await findByEmail(db, input.email);
        if (existing) return { ok: true, row: existing, existing: true };
      }
      if (message.includes("waitlist.discord_id") && input.discordId) {
        const existing = await findByDiscord(db, input.discordId);
        if (existing) return { ok: true, row: existing, existing: true };
      }
      if (message.includes("waitlist.ref_code")) continue;
      throw error;
    }

    if ((inserted.meta.changes ?? 0) === 0) {
      // The row was refused by the open/cap guard. Re-read the reason rather
      // than guessing, because an admin can change it between the two reads.
      const refused = await signupBlockedReason(db);
      return { ok: false, error: refused ?? "full" };
    }

    const row = await findByRef(db, code);
    if (!row) throw new Error("insert missing");

    const follow: D1PreparedStatement[] = [
      db
        .prepare("INSERT INTO signup_attempts (ip_hash, created_at) VALUES (?, ?)")
        .bind(ipHash, createdAt),
    ];
    if (referredBy) {
      follow.push(
        db
          .prepare("UPDATE waitlist SET referral_count = referral_count + 1 WHERE ref_code = ?")
          .bind(referredBy.ref_code),
      );
    }
    await db.batch(follow);
    return { ok: true, row, existing: false };
  }
  throw new Error("ref code exhausted");
}

export function toPublic(row: WaitlistRow, existing: boolean): PublicEntry {
  return {
    email: row.email,
    refCode: row.ref_code,
    status: statusFor(row.provision_state),
    existing,
  };
}
