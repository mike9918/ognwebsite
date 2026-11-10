import { autoProvisionEnabled, provisionEntry } from "./provision";

// Inline provisioning runs from the OAuth callback through ctx.waitUntil. That
// is one request's budget, so a slow panel or a crash can leave a person queued
// with no server. The scheduled handler picks those up, plus a bounded number
// of failures, using the same stale-claim guard as the admin button.
const QUEUE_GRACE_MS = 60 * 1000;
const MAX_ATTEMPTS = 3;
const PER_RUN = 2;

export async function sweepSignups(env: Env, now = new Date()): Promise<number> {
  // Without panel settings, or with automatic mode switched off, there is
  // nothing to retry: the admin button is the only path.
  if (!(await autoProvisionEnabled(env))) return 0;

  const graceBefore = new Date(now.getTime() - QUEUE_GRACE_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT id FROM waitlist
     WHERE provision_state IN ('queued', 'failed')
       AND provision_attempts < ?
       AND (provision_started_at IS NULL OR provision_started_at < ?)
     ORDER BY id
     LIMIT ?`,
  )
    .bind(MAX_ATTEMPTS, graceBefore, PER_RUN)
    .all<{ id: number }>();

  let done = 0;
  for (const row of results) {
    const outcome = await provisionEntry(env, row.id, now);
    if (outcome.state === "done") done += 1;
  }
  if (results.length > 0) {
    console.log(JSON.stringify({ event: "signup_sweep", picked: results.length, done }));
  }
  return done;
}
