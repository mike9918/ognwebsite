# OpenGameNode

The public site for OpenGameNode. The homepage is `/`. The waitlist form is `/wishlist`. Terms and privacy are placeholders until the legal drafts are ready.

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

## Database

Create the remote database when you are ready to deploy:

```sh
npx wrangler d1 create ogn-waitlist
```

Put the printed `database_id` on the `d1_databases` entry in `wrangler.jsonc`, then apply the migration:

```sh
npx wrangler d1 migrations apply ogn-waitlist --remote
```

The table is `waitlist`. Sign-ups store a salted SHA-256 of the IP, never the raw IP. Servers are managed from the web panel at `panel.opengamenode.com`, not from Discord. Discord OAuth on this site is only an optional waitlist sign-in. Migration SQL is in `migrations/`.

## Secrets

Set these with `npx wrangler secret put <NAME>` before a real deploy. `.dev.vars` supplies them locally and is gitignored.

| Name | Purpose |
| --- | --- |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key |
| `TURNSTILE_SECRET` | Turnstile secret for Siteverify |
| `TURNSTILE_HOSTNAMES` | Comma-separated hostnames Siteverify must return |
| `IP_HASH_SALT` | Salt for IP hashes |
| `ADMIN_TOKEN` | Bearer token for `GET /api/admin/export.csv` |
| `DISCORD_CLIENT_ID` | Leave empty to hide Discord sign-in |
| `DISCORD_CLIENT_SECRET` | Discord OAuth secret |
| `DISCORD_INVITE_URL` | Shown after sign-up. Empty hides the link |
| `PUBLIC_ORIGIN` | `https://opengamenode.com` in production. Empty locally, so referral links use the dev origin |

Production `TURNSTILE_HOSTNAMES` is `opengamenode.com,www.opengamenode.com`. Do not include `localhost` or `example.com` there.

Discord OAuth, when enabled, uses scopes `identify` and `email`. Register the callback `https://opengamenode.com/api/auth/discord/callback`.

## Checks

```sh
npm test
npm run check
```

`GET /api/admin/export.csv` with `Authorization: Bearer $ADMIN_TOKEN` returns the CSV. Without the token it returns 401.

## Routes

| Path | What it is |
| --- | --- |
| `/` | Homepage. `/?ref=` redirects to `/wishlist?ref=` |
| `/wishlist` | Waitlist form and success screen |
| `/terms`, `/privacy` | Placeholders |
| `/api/waitlist` | Sign-up |
| `/api/auth/discord` | Discord start, only when the client id and secret are set |
| `/api/admin/export.csv` | Admin export |

`www.opengamenode.com` redirects to the apex. There is no custom domain in `wrangler.jsonc`, so a deploy does not attach the apex until you add it.

## Brand

`public/brand/` has the four supplied logo files, unchanged. The header prefers `opengamenode-dark-960.png`, a 960-pixel-wide copy of `opengamenode-dark.png`, and falls back to the original file. The favicon is made from `opengamenode-icon.png`. Visitor-facing copy is in `src/content.ts`.
