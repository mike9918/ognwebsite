const DISCORD_EPOCH_MS = 1_420_070_400_000;
const DEFAULT_MIN_AGE_DAYS = 30;

/** Discord snowflake → account creation time in UTC. */
export function discordCreatedAt(snowflake: string): Date | null {
  if (!/^\d{5,30}$/.test(snowflake)) return null;
  try {
    const ms = Number((BigInt(snowflake) >> 22n) + BigInt(DISCORD_EPOCH_MS));
    if (!Number.isFinite(ms) || ms < DISCORD_EPOCH_MS) return null;
    return new Date(ms);
  } catch {
    return null;
  }
}

export function minDiscordAccountAgeDays(raw: string | undefined): number {
  if (raw === undefined || raw === "") return DEFAULT_MIN_AGE_DAYS;
  const days = Number(raw);
  if (!Number.isFinite(days) || days < 0) return DEFAULT_MIN_AGE_DAYS;
  return Math.floor(days);
}

export function isDiscordAccountOldEnough(
  snowflake: string,
  minAgeDays: number,
  now: Date,
): boolean {
  const created = discordCreatedAt(snowflake);
  if (!created) return false;
  const ageMs = now.getTime() - created.getTime();
  return ageMs >= minAgeDays * 24 * 60 * 60 * 1000;
}

/** Test helper: build a snowflake whose account is `ageDays` old at `now`. */
export function snowflakeForAgeDays(ageDays: number, now = new Date()): string {
  const createdMs = now.getTime() - ageDays * 24 * 60 * 60 * 1000;
  return String(BigInt(createdMs - DISCORD_EPOCH_MS) << 22n);
}
