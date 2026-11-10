# OpenGameNode

The public site for OpenGameNode. The homepage is `/` and carries the Discord sign-up form itself. `/signup` is the focused sign-up page; `/wishlist` is kept as an alias because the Discord OAuth callback and every referral link already shared point at it. Admin is `/admin`.

This is a Cloudflare Worker with static assets and a D1 database. It does not include the game panel. That will be `panel.opengamenode.com`.

Do not deploy this to production or change DNS from this repo's workflow. Michael does that.

## Local development

```sh
npm install
cp .dev.vars.example .dev.vars
npx wrangler d1 migrations apply ogn-waitlist --local
npm run dev
```

`wrangler dev` serves the site on `http://localhost:8787`. The example Turnstile values are Cloudflare's published dummy keys. Siteverify reports those tokens as `example.com`, so the local allowlist is `example.com`. A dummy secret accepts any token. Use it only on your machine.

For Discord OAuth locally, set `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET`, and register:

- `http://localhost:8787/api/auth/discord/callback`
- `http://localhost:8787/api/auth/admin/discord/callback`

Put your Discord user snowflake in `ADMIN_DISCORD_IDS`.

## Database

The remote D1 database is `ogn-waitlist`. Apply new migrations with:

```sh
npx wrangler d1 migrations apply ogn-waitlist --remote
```

Sign-ups require Discord. Rows store Discord id, username, verified email, and a salted SHA-256 of the IP. `waitlist_settings` holds open/closed and the optional signup cap. Servers are managed from the web panel at `panel.opengamenode.com`, not from Discord.

A new sign-up is written with `provision_state = 'queued'` and provisioned
immediately after the redirect. Provisioning is resumable, so the same row holds
the claim, the panel ids and the notification timestamps.

### Sign-up capacity

The cap is the number of rows holding a free slot: `provision_state` in
`queued`, `running` or `done`. Legacy waitlist rows (`NULL`) and `failed` rows do
not hold a slot, so a hard failure never silently eats capacity — but it also
means legacy rows must be provisioned or deleted deliberately before opening.

`GET /api/capacity` returns `{ "accepting": boolean }` and nothing else: the cap
value is never public. The homepage and `/signup` read the same check and swap
the button for the at-capacity block, so no surface can advertise a number.

A cap of `0` means at capacity (an instant pause), and leaving it blank means no
cap. The launch cap is 25 slots (`migrations/0007_signup_cap_default.sql`), and
staff change it, or clear it, in `/admin` without a deploy. The insert itself
carries the check (`INSERT … SELECT … WHERE count < cap`), so two sign-ups racing
cannot overshoot it.

`triggers.crons` runs `sweepSignups` every five minutes: it retries rows that are
still `queued` after a minute, and failed rows under three attempts. Without the
panel and mail settings, or with `AUTO_PROVISION` unset, it is a no-op, which
keeps the staff-provisioned flow working.

Migration `0006_signup_slots.sql` adds the partial index behind that count. It
rewrites no rows. Migration `0007_signup_cap_default.sql` only fills in the cap
when it is still unset.

## Secrets and vars

Set secrets with `npx wrangler secret put <NAME>`. `.dev.vars` supplies them locally and is gitignored.

| Name | Purpose |
| --- | --- |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key |
| `TURNSTILE_SECRET` | Turnstile secret for Siteverify |
| `TURNSTILE_HOSTNAMES` | Comma-separated hostnames Siteverify must return |
| `IP_HASH_SALT` | Salt for IP hashes |
| `ADMIN_TOKEN` | Bearer token for `GET /api/admin/export.csv` |
| `ADMIN_DISCORD_IDS` | Comma-separated Discord user ids allowed into `/admin` |
| `DISCORD_CLIENT_ID` | Discord OAuth client id |
| `DISCORD_CLIENT_SECRET` | Discord OAuth secret |
| `DISCORD_BOT_TOKEN` | Bot token from the same application, stored only as a Worker secret |
| `DISCORD_GUILD_ID` | Target OGN server ID |
| `DISCORD_INVITE_URL` | Shown after sign-up. Empty hides the link |
| `PUBLIC_ORIGIN` | `https://opengamenode.com` in production. Empty locally |
| `CALAGOPUS_API_KEY` | Calagopus admin API key, used only for provisioning |
| `MS_GRAPH_TENANT_ID` | Microsoft 365 tenant for app-only sending |
| `MS_GRAPH_CLIENT_ID` | Entra app registration client id |
| `MS_GRAPH_CLIENT_SECRET` | Entra app registration client secret |
| `RESEND_API_KEY` | Fallback email sender when Microsoft 365 is not configured |

`MIN_DISCORD_ACCOUNT_AGE_DAYS` is a Wrangler var (default `30`). Accounts younger than that cannot join.

`AUTO_PROVISION` is a dashboard var, unset by default: a sign-up stays `queued`,
the cron sweep does not run, and staff click Provision. Set it to `1` to
provision each new sign-up in the background instead.

Provisioning settings are dashboard vars, not `wrangler.jsonc` vars: `CALAGOPUS_URL`,
`CALAGOPUS_NEST_UUID`, `CALAGOPUS_EGG_VANILLA`, `CALAGOPUS_EGG_PLUGINS`,
`CALAGOPUS_EGG_MODPACK`, either `CALAGOPUS_NODE_UUID` or
`CALAGOPUS_LOCATION_UUIDS` (comma-separated), and `EMAIL_FROM`. A missing or
invalid value leaves the Provision button disabled. Locally they go in
`.dev.vars`.

`keep_vars` is set in `wrangler.jsonc` so `wrangler deploy` does not delete the
dashboard values. Without it, Wrangler removes every variable that is not in the
config file. The API keys are secrets, are stored separately from vars, and are
deliberately not in `secrets.required`, so a deploy still works before the panel
and email account exist.

### Discord sign-in

Provisioned users sign in to the panel with Discord, so the waitlist identity and
the panel account stay the same person. The panel only does that when the link
already exists: a Discord sign-in with no link either creates a second account or
stops with `user_already_exists` when the Discord email matches ours.

- Panel → Admin → OAuth Providers → Discord → General: turn on **Linkable with
  API Keys**. Only a signed-in administrator can set it, and it is what lets an
  API key create links. On a panel build without that switch, PATCH the provider
  from the browser console while signed in:
  `await fetch('/api/admin/oauth-providers/<provider>', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ api_linkable: true }) }).then(r => r.status)`
- `CALAGOPUS_DISCORD_PROVIDER_UUID` in `wrangler.jsonc` is that provider's UUID
  (the provider page shows it, and `GET /api/auth/oauth` lists it publicly).
- The API key needs `users.oauth-links`, `users.impersonate` and
  `oauth-providers.read`. Without the first two the panel answers 403 and the row
  names them; the read permission lets a duplicate-link conflict be checked
  against the real owner instead of trusting the panel's 409.

Provisioning links `waitlist.discord_id` to the new panel user before it creates
the server, and a retry re-runs only that step. While the provider UUID is set, a
rejected link fails the provision instead of sending a message that promises a
sign-in that would not work; clear that error by fixing the panel permissions.
Without the UUID, the DM and email ask the user to sign in by email instead.

### Server creation

Servers are created stopped, with the egg installer enabled, so the install runs
before anyone presses Start. Any egg variable named `EULA` (or ending in `_EULA`)
is sent as `true`: Minecraft eggs default it to `false`, which leaves the install
and the first start refusing to run until someone accepts it by hand and
reinstalls. Every other variable keeps the egg's own default value.

### Waitlist card

Every completed Discord signup posts one card to the server's `waitlist` channel
(handle, email, plan, want, referral code, place in the queue). Provisioning
edits that same message in place: the heading turns into `✅ Provisioned` and the
server, panel user and server URL are added. Channel and message ids are stored
on the row, so a retry edits the existing card instead of posting a second one.

`DISCORD_WAITLIST_CHANNEL_ID` pins the channel; without it the bot looks up a
text channel named `waitlist` (or `wait-list`) in `DISCORD_GUILD_ID`, once per
isolate. The card is best effort: a Discord failure is logged and the signup or
provision still succeeds. The bot needs Send Messages in that channel; no role
ping is used, and visitor-supplied text can't mention anyone.

Production `TURNSTILE_HOSTNAMES` is `opengamenode.com,www.opengamenode.com`.

Discord OAuth scopes:

- Waitlist: `identify email guilds.join`
- Admin: `identify`

## Checks

```sh
npm test
npm run check
```

## Routes

| Path | What it is |
| --- | --- |
| `/` | Frontpage: hero, how it works, features, sessions, games, Supporter teaser, FAQ preview, sign-up form. `/?ref=` redirects to `/wishlist?ref=` |
| `/signup` | Discord sign-up form and sign-up status screen (alias of `/wishlist`) |
| `/wishlist` | Canonical URL for the sign-up page; Discord OAuth and referral links return here |
| `/faq` | Full FAQ, final approved copy |
| `/supporter` | Supporter tier, $1.99/month. Checkout button is a placeholder until Stripe is live |
| `/help` | Index of the five help guides |
| `/help/<slug>` | `first-server`, `invite-friends`, `upload-a-world`, `backups`, `supporter-billing` |
| `/terms`, `/privacy`, `/aup` | Legal pages rendered from `src/legal.ts` |
| `/admin` | Discord-gated admin: sign-ups, delete, open/close, cap, retry provisioning |
| `/api/auth/discord` | Waitlist Discord start |
| `/api/auth/admin/discord` | Admin Discord start |
| `/api/admin/settings` | Save open/close and cap |
| `/api/admin/entries/delete` | Delete one waitlist row (admin session) |
| `/api/admin/entries/provision` | Create the Calagopus account and server, DM and email (admin session) |
| `/api/admin/export.csv` | CSV export (admin session or bearer token) |
| `/api/capacity` | Public `{ accepting: boolean }` flag for the at-capacity state |

`www.opengamenode.com` redirects to the apex. Custom domains for the apex and `www` are in `wrangler.jsonc`.

## Provisioning

Sign-ups are provisioned by staff: **Provision** on a row runs the whole flow by
hand. With `AUTO_PROVISION=1` the same work starts on its own after the Discord
callback returns, in the background (`ctx.waitUntil`), and the cron sweep retries
anything that did not finish. **Provision** stays the retry path either way.

Provisioning runs the whole onboarding in the Worker, in this order: Calagopus account (`external_id` = `ogn-<row id>`, panel email included) →
server with the plan for that row's `run_type` → Discord DM → email. It is one
request so the admin sees the result immediately, and it stays resumable: the
panel UUIDs are written to D1 as soon as they exist, so a retry after a failure
skips the account and server it already made and only redoes the missing step.

Plans live in `src/plans.ts` (2 GB vanilla and Paper, 3 GB modpack, 10 GB disk,
1 backup, 1 schedule). Change the numbers there, not in the provisioning code.
Egg UUIDs and the target node or locations are panel configuration in
`wrangler.jsonc`. A given run type with no egg configured fails with a clear
error instead of falling back to the wrong egg.

The DM needs `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID`; membership is rechecked
before messaging and the row's DM consent is required. If Discord refuses the DM
(closed DMs, left the guild) the email is the fallback; if a configured email
sender fails, the row is marked failed and Retry sends only the email. Everything
is logged as numeric status codes, never tokens, addresses or message bodies.

### Email sender

Microsoft 365 / Exchange Online is used when `MS_GRAPH_TENANT_ID`,
`MS_GRAPH_CLIENT_ID` and `MS_GRAPH_CLIENT_SECRET` are set; otherwise Resend with
`RESEND_API_KEY`. The domain is already verified in Microsoft 365, so Graph needs
no extra sending domain, and the sender must be a real Exchange Online mailbox
(the P1 mailbox is fine). Do not use SMTP with a mailbox password: Exchange
Online has retired basic SMTP AUTH.

Set up Graph once:

1. Entra admin center → App registrations → New registration (single tenant).
2. API permissions → Microsoft Graph → **Application** → `Mail.Send` → Grant admin consent.
3. Certificates & secrets → new client secret, then `wrangler secret put` the three values.
4. Scope the app so `Mail.Send` cannot send as every mailbox. Exchange Online now
   uses RBAC for Applications, which replaces Application Access Policies:

   ```powershell
   # Object id is the service principal on the app's Overview blade, not the
   # Application (client) id.
   New-ServicePrincipal -AppId <client-id> -ObjectId <service-principal-object-id> `
     -DisplayName "OpenGameNode provisioning"

   New-ManagementScope -Name "OGN provisioning sender" `
     -RecipientRestrictionFilter "PrimarySmtpAddress -eq 'hello@opengamenode.com'"

   New-ManagementRoleAssignment -App <service-principal-object-id> `
     -Role "Application Mail.Send" -CustomResourceScope "OGN provisioning sender"
   ```

   `Get-ManagementRole -RoleType Application` lists the exact role name on your
   tenant. `Test-ServicePrincipalAuthorization -Identity <service-principal-object-id>
   -Resource hello@opengamenode.com` shows whether the scope applies. Role changes
   take 30 minutes to 2 hours to reach a running app.
5. `EMAIL_FROM` must be an address on that mailbox; the display name is only used by Resend.

Graph takes about an hour-long app-only token, cached per Worker isolate, and sends
with `saveToSentItems: false` so notifications do not fill the mailbox's Sent Items.
The provider split lives in `src/email.ts`, so adding another sender is one function.

Why this is not in n8n: the panel account and server are the durable side
effects, so the code that creates them has to own the claim, the idempotency
keys (`external_id`) and the per-row state in D1. An n8n webhook would add a
second source of truth and a hop that cannot tell the admin table what happened.
n8n is still a fine place for ops alerts or staff-channel notifications later,
as a fire-and-forget call after the row is `done`.

Before release, apply migrations `0004_provisioning.sql` and
`0006_signup_slots.sql`, then smoke-test one row per run type, a retry after a
forced panel failure, a member with DMs closed, and the at-capacity state.

## Brand

`public/brand/` has the four supplied logo files, unchanged, plus `og-default.png` for link previews. Visitor-facing copy is in `src/content.ts`. Legal text is in `src/legal.ts` and help guides are in `src/guides.ts`; both are Markdown rendered by `src/markdown.ts`. The approved legal drafts Michael reviewed are kept in `content/legal/` for reference.

## Copy sources

- Homepage, FAQ, Supporter and footer copy: AUD-16 / AUD-20 final text, delivered Nov 1 2026.
- Legal drafts: AUD-20 final attachments, mirrored in `src/legal.ts`.
- Help guides: drafted from the confirmed product facts. Placeholder-free, but worth a read before publishing.

Ads are not on this site. AdSense and the consent banner belong to the panel at `panel.opengamenode.com`.

## Discord waitlist join rollout

Before publishing, apply migration `0003_discord_join.sql` and configure the two
new bindings above. Install the bot from the OAuth application's own Bot page
in OGN with Create Instant Invite permission. Do not request Administrator.
Keep the existing OAuth callback URLs. Admin OAuth still requests only identify.

The callback requests consent to join OGN and receive provisioning notifications,
then uses Discord's Add Guild Member API. Both 201 (joined) and 204 (existing
member) succeed. Errors, bans, rate limits and timeouts do not finalize signup.
The signed pending draft preserves choices for ten minutes; retry starts fresh
OAuth. Tokens are never written to D1, cookies or logs. A Discord join followed
by a database failure is safe to retry: Discord returns 204 on the next attempt.
Membership screening is not bypassed; the success page asks users to finish it.

Existing rows retain NULL join/DM-consent timestamps until the user completes
this flow. Do not treat legacy rows as confirmed members or opted into DMs.
Future provisioning should recheck membership and use discord_id to address DMs,
with email fallback. This change does not send DMs or provision game servers.
Smoke-test new members, existing members, cancelled consent, screening and a
failed join using a test Discord application/guild before production release.
