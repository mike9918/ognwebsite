# PR: Open free sign-ups with Discord (AUD‑65, AUD‑66, AUD‑67)

Branch: `cursor/finish-open-signups-a41e` · Base: `main`
Basis: Freebuff `freebuff/f2e018cbc212d2d2e5179164`, finished for merge review.

---

## What this does

Replaces the waitlist with open free Discord sign-ups, enforces a server-side
slot cap, swaps the CTA for an at-capacity state, and stores Automatic / Manual
provisioning as an admin setting.

| Ticket | Where it landed |
| --- | --- |
| AUD‑65 site copy and CTA | `src/content.ts`, `src/html.ts`, `src/guides.ts`, `src/legal.ts`, `/signup` |
| AUD‑66 cap and modes | `src/settings.ts`, `src/signup.ts`, `src/admin.ts`, `src/sweep.ts`, migrations `0006`–`0008` |
| AUD‑67 message copy | `src/content.ts` (`success.*`, `provision.*`, `capacity.*`); Marketing welcome DM/email drafts still need separate approval before any new send path |

### Behaviour

- Every new sign-up is `queued`. Manual (default) waits for Provision in `/admin`.
- Automatic mode (admin toggle) provisions after the Discord redirect and the
  five-minute cron retries unfinished rows.
- Launch cap is 25 (`0007`); staff change or clear it in Admin → Sign-up controls.
- Cap check is part of the insert; races cannot overshoot.
- `GET /api/capacity` returns `{ "accepting": boolean }` only.
- Referral UI and referral counting are removed. `ref_code` remains an internal
  signup id (welcome URL + panel username suffix).
- Migration `0008` deletes legacy waitlist rows (`provision_state IS NULL`) and
  adds `auto_provision`.

---

## Before deploy

1. Apply migrations `0006`, `0007`, `0008` on staging, then production.
2. Confirm cron `*/5 * * * *` after deploy.
3. Confirm panel + mail settings before flipping Automatic on.
4. Smoke: one Manual signup + Provision, one Automatic signup, cap `0`, repeat Discord.

---

## Notes

- Visitor copy is honest for Manual-as-default and switches preparing text when
  Automatic is on.
- Full Marketing AUD‑67 welcome DM/email templates are not wired yet (draft on
  the Linear issue is still unapproved). Ready notices are updated in-repo.
