export type WaitlistSettings = {
  isOpen: boolean;
  signupCap: number | null;
  updatedAt: string;
  signupCount: number;
};

type SettingsRow = {
  is_open: number;
  signup_cap: number | null;
  updated_at: string;
};

export async function getSettings(db: D1Database): Promise<WaitlistSettings> {
  const [settings, countRow] = await Promise.all([
    db.prepare("SELECT is_open, signup_cap, updated_at FROM waitlist_settings WHERE id = 1").first<SettingsRow>(),
    db.prepare("SELECT COUNT(*) AS n FROM waitlist").first<{ n: number }>(),
  ]);
  return {
    isOpen: (settings?.is_open ?? 1) === 1,
    signupCap: settings?.signup_cap ?? null,
    updatedAt: settings?.updated_at ?? "",
    signupCount: countRow?.n ?? 0,
  };
}

export async function updateSettings(
  db: D1Database,
  input: { isOpen: boolean; signupCap: number | null; now: Date },
): Promise<WaitlistSettings> {
  await db
    .prepare(
      `UPDATE waitlist_settings
       SET is_open = ?, signup_cap = ?, updated_at = ?
       WHERE id = 1`,
    )
    .bind(input.isOpen ? 1 : 0, input.signupCap, input.now.toISOString())
    .run();
  return getSettings(db);
}

export async function signupBlockedReason(
  db: D1Database,
): Promise<"closed" | "full" | null> {
  const settings = await getSettings(db);
  if (!settings.isOpen) return "closed";
  if (settings.signupCap !== null && settings.signupCount >= settings.signupCap) return "full";
  return null;
}
