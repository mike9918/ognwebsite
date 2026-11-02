# OpenGameNode

The public site for OpenGameNode. The homepage is `/`. The waitlist form is `/wishlist`. Admin is `/admin`. Terms and privacy are placeholders until the legal drafts are ready.

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
| `DISCORD_INVITE_URL` | Shown after sign-up. Empty hides the link |
| `PUBLIC_ORIGIN` | `https://opengamenode.com` in production. Empty locally |

`MIN_DISCORD_ACCOUNT_AGE_DAYS` is a Wrangler var (default `30`). Accounts younger than that cannot join.

Production `TURNSTILE_HOSTNAMES` is `opengamenode.com,www.opengamenode.com`.

Discord OAuth scopes:

- Waitlist: `identify email`
- Admin: `identify`

## Checks

```sh
npm test
npm run check
```

## Routes

| Path | What it is |
| --- | --- |
| `/` | Homepage. `/?ref=` redirects to `/wishlist?ref=` |
| `/wishlist` | Discord waitlist form and success screen |
| `/admin` | Discord-gated admin: submissions, delete, open/close, cap |
| `/terms`, `/privacy` | Placeholders |
| `/api/auth/discord` | Waitlist Discord start |
| `/api/auth/admin/discord` | Admin Discord start |
| `/api/admin/settings` | Save open/close and cap |
| `/api/admin/entries/delete` | Delete one waitlist row (admin session) |
| `/api/admin/export.csv` | CSV export (admin session or bearer token) |

`www.opengamenode.com` redirects to the apex. Custom domains for the apex and `www` are in `wrangler.jsonc`.

## Brand

`public/brand/` has the four supplied logo files, unchanged. Visitor-facing copy is in `src/content.ts`.
