export type WaitlistSettings = {
  isOpen: boolean;
  signupCap: number | null;
  // Automatic = provision in the background after Discord sign-up.
  // Manual = staff click Provision in /admin (default).
  autoProvision: boolean;
  updatedAt: string;
  // Every stored sign-up row.
  signupCount: number;
  // Rows that hold one of the free slots: queued, being provisioned, or done.
  // Failed rows do not hold a slot, so a hard failure never silently eats capacity.
  occupiedCount: number;
};

type SettingsRow = {
  is_open: number;
  signup_cap: number | null;
  auto_provision: number | null;
  updated_at: string;
};

type CountRow = {
  total: number;
  occupied: number;
};

// Kept as one constant so the cap check and the admin readout can never drift.
export const OCCUPIED_SQL = "provision_state IN ('queued', 'running', 'done')";

export async function getSettings(db: D1Database): Promise<WaitlistSettings> {
  const [settings, counts] = await Promise.all([
    db
      .prepare(
        "SELECT is_open, signup_cap, auto_provision, updated_at FROM waitlist_settings WHERE id = 1",
      )
      .first<SettingsRow>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM waitlist) AS total,
                (SELECT COUNT(*) FROM waitlist WHERE ${OCCUPIED_SQL}) AS occupied`,
      )
      .first<CountRow>(),
  ]);
  return {
    isOpen: (settings?.is_open ?? 1) === 1,
    signupCap: settings?.signup_cap ?? null,
    autoProvision: (settings?.auto_provision ?? 0) === 1,
    updatedAt: settings?.updated_at ?? "",
    signupCount: counts?.total ?? 0,
    occupiedCount: counts?.occupied ?? 0,
  };
}

export async function updateSettings(
  db: D1Database,
  input: {
    isOpen: boolean;
    signupCap: number | null;
    autoProvision: boolean;
    now: Date;
  },
): Promise<WaitlistSettings> {
  await db
    .prepare(
      `UPDATE waitlist_settings
       SET is_open = ?, signup_cap = ?, auto_provision = ?, updated_at = ?
       WHERE id = 1`,
    )
    .bind(
      input.isOpen ? 1 : 0,
      input.signupCap,
      input.autoProvision ? 1 : 0,
      input.now.toISOString(),
    )
    .run();
  return getSettings(db);
}

export async function signupBlockedReason(
  db: D1Database,
): Promise<"closed" | "full" | null> {
  const settings = await getSettings(db);
  if (!settings.isOpen) return "closed";
  if (settings.signupCap !== null && settings.occupiedCount >= settings.signupCap) return "full";
  return null;
}
