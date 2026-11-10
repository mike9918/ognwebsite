# PR: Open free sign-ups with Discord (AUD‑65, AUD‑66, AUD‑67)

Branch: `freebuff/f2e018cbc212d2d2e5179164` · Base: `main`
Status: work complete and checked locally, **not committed, pushed or deployed.**
Nothing in this PR is live, and no production data has been touched.

AUD‑63's guardrails apply: staging only, no panel/bot/Cloudflare credentials in
the repo, PR for your review, and you decide when production changes.

---

## 1. What this does

Replaces the waitlist with open free sign-ups through Discord, enforces the free
slot cap on the server and swaps the button for an at-capacity state when the
slots are taken. Sign-ups launch with 25 free slots, and staff provision each one
by hand from `/admin` for now; automatic provisioning is one var away.

| Ticket | Where it landed |
| --- | --- |
| AUD‑65 site copy and CTA | `src/content.ts`, `src/html.ts`, `src/guides.ts`, `src/legal.ts`, new `/signup` route |
| AUD‑66 cap and at-capacity | `src/settings.ts`, `src/signup.ts`, `src/index.ts`, `src/sweep.ts`, `src/provision.ts`, `migrations/0006_signup_slots.sql`, `migrations/0007_signup_cap_default.sql`, `wrangler.jsonc` |
| AUD‑67 message copy | `src/content.ts` (`provision.*`), unchanged `src/notify.ts` builders |

### Behaviour now

- Every sign-up is written `queued` and the person is told their server is being
  set up. Staff click Provision in `/admin`, which creates the panel account and
  server and then sends the DM and email.
- `AUTO_PROVISION=1` (dashboard var, unset by default) moves that work into the
  background right after the Discord redirect. Unset or `0` is the staff variant
  AUD‑67 writes copy for, and it is what the test suite uses so a sign-up never
  calls the panel.
- The launch cap is 25 slots (`migrations/0007_signup_cap_default.sql`), changed
  by staff in Admin → Sign-up controls.
- The cap check is part of the insert (`INSERT … SELECT … WHERE count < cap`), so
  two sign-ups racing cannot overshoot it. The pre-checks stay only for a fast
  message.
- `GET /api/capacity` returns `{ "accepting": boolean }`. No count, no cap.
- At capacity (or cap `0`) the homepage and `/signup` render a message block
  instead of the form.
- The cron sweep retries a sign-up whose inline provisioning did not finish.
- `/signup` is added; `/wishlist` still works (OAuth callback and shared links).

---

## 2. Decisions I made to keep moving

These are defaults, not settled product calls. Each is a one-line change to
reverse, and each is on the action list below.

1. **Staff provision sign-ups for now**, with automatic provisioning one var
   away: `AUTO_PROVISION=1` in the dashboard makes each sign-up provision itself
   in the background, and the admin Provision button is the retry path in both
   modes, so AUD‑67's two variants both work.
2. **A slot = a row that is queued, provisioning or done.** Legacy waitlist rows
   (`provision_state IS NULL`) and failed rows do not consume capacity.
3. **Over-cap sign-ups are not stored and not notified.** They are refused before
   a row is created. A "we'll let you know" promise would be a waitlist again.
   This answers AUD‑66's open question; there is no at-capacity DM/email to send.
4. **Queue position and the referral upsell are gone from the public success
   screen.** "Your place is N" and "each friend moves you up" contradict
   no-queue framing. `ref_code`, `referred_by` and `referral_count` still work and
   still count, so nothing in D1 changed.
5. **The URL, table, cookies and CSS keep the `wishlist` names.** Renaming them
   would break the registered OAuth callbacks and every link already shared. Only
   visitor-facing copy changed, plus the `/signup` alias.
6. **Copy is a working draft for OGN Marketing.** I wrote it to the rules in
   AUD‑65/67; it is not marketing-approved.

---

## 3. Your action items

Nothing here blocks review. Items 1–5 must be done before open sign-ups are safe
to publish.

### Before merge

- [ ] **1. Check the cap.** Migration `0007` sets it to 25 on a database whose cap
      is still unset. Staff change it, or clear it, in Admin → Sign-up controls
      (blank = no cap, `0` = at capacity) with no deploy.
- [ ] **2. Decide the legacy waitlist rows.** They are listed in `/admin` and do
      not count toward the cap. Either provision them (they then take a slot) or
      delete them before you open sign-ups. I did not touch existing rows.
- [ ] **3. Approve the copy.** `src/content.ts` is the single file for all
      visitor copy, including the approved queue line ("a server queues only if
      4 others are already starting or the node is full"). Legal §3 and the
      first-server guide now carry the same line.
- [ ] **4. Confirm the referral decision** (assumption 4). If referrals should
      stay visible, the success screen needs a new reason for the link.
- [ ] **5. Update the Brand kit or confirm the CTA.** The kit's primary action is
      "Create a server"; AUD‑65 asks for "Sign up free with Discord". I used the
      ticket's wording on the button.

### At deploy time

- [ ] **6. Apply migrations `0006` and `0007`** to the staging database first,
      then production. `0006` adds a partial index and rewrites no rows; `0007`
      only fills in a cap that is still unset, so a cap you already chose is never
      overwritten.
- [ ] **7. Check the cron is registered.** `wrangler.jsonc` now declares
      `triggers.crons` (`*/5 * * * *`) and the Worker exports `scheduled`. Confirm
      the trigger appears in the dashboard after deploy. Without it, a sign-up
      whose inline provisioning failed sits queued until someone clicks Provision.
- [ ] **8. Confirm the panel settings are present in staging.** Without
      `CALAGOPUS_*` and mail settings, sign-ups stay `queued` and the Provision
      button is disabled — nothing can be provisioned, which is a config gap, not
      a bug. Staff provisioning is the shipped default; set `AUTO_PROVISION=1` in
      the dashboard when you want sign-ups to provision themselves. Confirm the
      API key still
      has `users.oauth-links`, `users.impersonate` and `oauth-providers.read`, and
      that the Discord provider is still linkable, or provisioning fails on the
      link step.
- [ ] **9. Discord channel.** The bot still looks for a channel named
      `waitlist`/`wait-list` for the sign-up card. Either rename it or set
      `DISCORD_WAITLIST_CHANNEL_ID`. The card heading now says "New sign-up".
- [ ] **10. Deploy and smoke-test** (I cannot and will not deploy): one sign-up
      end to end, one sign-up at cap `0`, one forced panel failure then a sweep
      retry, and one repeat sign-up with the same Discord account.

### Worth considering later

- [ ] **11. Abuse tuning.** Open sign-ups keep the Turnstile check, the 30-day
      Discord age gate, one row per Discord id/email and 5 sign-ups per IP per
      hour. The cap is now the main cost control; if we see farming, lower the
      per-IP limit or raise the age gate.
- [ ] **12. Admin alerting** when refused sign-ups spike. There is currently no
      counter for refused attempts (deliberately no PII), only the log line
      `capacity_refused` would need adding.

---

## 4. How it was checked

Both pass locally against a clean `npm ci`:

- `npm run check` — exit 0.
- `npm test` — 3 files, 39 tests, all passing.
- Copy guard: the tests assert that the visible text of `/`, `/wishlist`,
  `/signup`, `/faq`, `/help` and `/help/first-server` contains neither
  "waitlist" nor "limited slot". Asset names, ids and CSS classes keep the word
  internally and are deliberately not part of the guard.
- New tests cover the boolean-only capacity endpoint, the at-capacity render
  replacing the form, every sign-up being queued, and legacy rows not consuming
  the cap.

Not covered, and needs a human:

- A true concurrent race on the cap. The insert is a single statement, which is
  why it is safe, but the suite does not fire two callbacks at once.
- Live Calagopus / Discord / Graph behaviour, which the tests mock.
- Anything visual. The at-capacity block was not viewed in a browser.

---

## 5. Risks and rollback

| Risk | Mitigation |
| --- | --- |
| A sign-up stuck `queued` after a crash | Cron sweep retries after 60s, max 3 attempts |
| Panel slow, user sees "setting up" a while | Success page states this; DM/email still go out on completion |
| Wrong cap set | Admin control, no deploy needed; `0` pauses instantly |
| Staff miss a queued sign-up | It shows as queued in `/admin` and stays counted as an occupied slot, so the cap never oversells |
| Legacy rows surprise you after opening | They are visible in `/admin` and never counted |
| Bad copy ships | All strings are in one file, revertable independently of logic |

Rollback is a deploy revert plus, if wanted, dropping the index from migration
0006. No destructive migration, no data rewrite, no secret change.

---

## 6. Review order

1. `src/settings.ts` and `src/signup.ts` — slot definition and the atomic insert.
2. `src/index.ts` — `/api/capacity`, `/signup`, the scheduled handler.
3. `src/discord.ts` and `src/sweep.ts` — when provisioning starts and retries.
4. `src/content.ts` — every line a visitor reads.
5. `src/html.ts` — at-capacity block and the status screen.
6. The rest: `admin.ts`, `board.ts`, `guides.ts`, `legal.ts`, README, tests.

---

## 7. Open questions

1. Does 25 stay fixed for launch, or should the cap track node RAM? It is a
   number in `/admin`, so either can change without a deploy.
2. Legacy waitlist rows: provision or delete before opening?
3. When do we switch `AUTO_PROVISION` on? Staff provisioning is the shipped
   default; both modes are covered by the tests.
4. Referrals: keep a visible link with no queue benefit, or retire the program?
5. Do we want a public "at capacity" page URL (for ads/links) or only the inline
   state?
