// The five help guides required before the AdSense application. Written from
// the confirmed product facts in AUD-20 and the final FAQ copy, so nothing
// here promises a feature or a limit that is not settled.

export type Guide = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  body: string;
};

export const guides: readonly Guide[] = [
  {
    slug: "first-server",
    title: "Get your first server running",
    summary: "Sign up with Discord, pick what you're running, and start your server from the panel.",
    minutes: 4,
    body: `
OpenGameNode hosts Minecraft servers for free. The [free Minecraft server page](/free-minecraft-server) lists the RAM, disk and session limits. This guide walks through the whole thing, from signing up to your first join.

## 1. Sign up free

Tap Sign up free with Discord on the [homepage](/) or the [sign-up page](/signup), pick what you're running, and sign in with your Discord account. We create your panel account from your verified Discord email, so there's nothing to fill in and no password to set up. We'll DM or email you when your server is ready.

We ask for Discord so each person gets one account. We never post or send DMs on your behalf, and we only read your Discord ID, username and verified email.

## 2. Sign in to the panel

When your server is ready, go to panel.opengamenode.com and sign in with Discord. The panel is where you start your server, see your address and manage your files.

You're signed out after about an hour of inactivity. Your servers keep running while you're signed out.

## 3. Pick what you're running

Choose vanilla if you want plain Minecraft, plugins if you want Paper with plugins, or a modpack if you're running a curated set of mods. You can name the modpack or version so it's clear later.

## 4. Click Start

Each Start gives you a session of about four hours, with a countdown on your server page. There's no ad to watch first. A server only queues if 4 others are already starting or the node is full.

## 5. Connect and play

Your server page shows the address to connect to and the SFTP details for uploading files. Add the address in Minecraft, or share it with your friends.

## When the session ends

In the last ten minutes you can click Extend to add about four more hours, twice a day. After both extensions are used, the server shuts off and players are disconnected. Your world and files are saved. Click Start again for a fresh session. Supporter servers are not cut off after four hours.

If nobody is on the server for five minutes, it shuts off to free room for other people. That cancels the session, and a player joining won't turn it back on. The owner clicks Start.

## If something goes wrong

Ask in our Discord or email support@opengamenode.com. Include your Discord username and the server you're asking about.
`,
  },
  {
    slug: "invite-friends",
    title: "Invite friends to your server",
    summary: "Share your address, keep track of session times, and know what your friends will see.",
    minutes: 3,
    body: `
Once your server is running, anyone you share the address with can join. Here's what to expect.

## Get the address

Open your server page in the panel. The address is listed there, and you can copy it straight from the page.

## Share it

Send the address to your friends however you like — Discord, a group chat, anywhere. Friendlier option: our Discord has channels for exactly this.

## Tell them about session times

Your server only runs during a session. Sessions last about four hours and start when the owner clicks Start. If a friend joins while the server is off, they can't start it for you. Only the owner can.

When the time runs out, everyone is disconnected with a message pointing at panel.opengamenode.com. If you extend in the last ten minutes, you get about four more hours and your friends stay on. You can extend twice a day. A Supporter server is not cut off after four hours.

## If the server goes quiet

Five minutes with nobody online is enough to switch the server off. That frees capacity for other people, and your world and files stay saved. Click Start to bring it back for a fresh session.

## Who can join

Your friends each need their own OpenGameNode account to run a server, but they don't need one to play on yours. They do need to follow our [acceptable use policy](/aup) while they're on it.

If a friend is under 18, they need a parent or guardian's OK to use OpenGameNode themselves.
`,
  },
  {
    slug: "upload-a-world",
    title: "Upload a world you already have",
    summary: "Move a world you still have the files for onto your OpenGameNode server.",
    minutes: 4,
    body: `
If you still have the files from another host or a single-player world, you can move them onto your OpenGameNode server.

## Before you start

Keep a copy of the world on your own computer. Uploading replaces what's on the server, so it's worth having the original safe in case something goes wrong.

We can only help with files you still have. OpenGameNode cannot reach into another host and recover a world for you.

## Upload over SFTP

Your server page in the panel shows the SFTP details for your server. Connect with an SFTP client, then upload the world folder into the server's directory.

A Minecraft world is the folder containing the level.dat file, along with its region files. Upload the folder as-is rather than renaming its contents, because the server expects that structure.

## Restart the server

Stop the server before you upload, then start it again afterwards so it picks up the new world. If the server is already running while you upload, changes may not be applied and files can conflict.

## Common problems

- **The server generated a fresh world instead.** The world folder is probably in the wrong place, or the folder that holds level.dat is nested one level too deep.
- **The server won't start.** Check the version. A world created in a much newer or older Minecraft version may need upgrading first, and modded worlds need the same mods installed.
- **Some chunks are missing.** The upload was probably interrupted. Re-upload the folder and try again.

If you're stuck, ask in our Discord with the version you're running and what the console says.
`,
  },
  {
    slug: "backups",
    title: "Keep your own backups",
    summary: "Why you should keep your own copy of your world, and the simplest way to do it.",
    minutes: 3,
    body: `
Free hosting is best-effort. Please keep your own backups.

## Why this matters

OpenGameNode is free and ad-supported, and capacity, features and limits can change. We don't promise that the service will be available at a particular time, and we don't promise that any backup on our side will exist, be complete or be restorable. The copy you keep is the one you can rely on.

We may also remove servers, worlds or files belonging to accounts that have been inactive for a long time.

## The simplest backup

1. Stop your server from the panel so the world isn't being written to while you copy it.
2. Connect over SFTP using the details on your server page.
3. Download the world folder — the one containing level.dat — to your own computer.
4. Start the server again.

Name the folder with the date so you can tell copies apart later.

## When to take one

- Before uploading a new world or a big modpack change.
- Before inviting a lot of new players.
- Once a week for a world you care about, even if nothing has changed.

## What a backup won't cover

A backup of the world folder doesn't include your server configuration or plugin settings. If you've spent time tuning those, download those files too.

Worlds are saved between sessions, so a server that shuts off because nobody was online keeps its files. That is not a backup — it's the live copy.
`,
  },
  {
    slug: "supporter-billing",
    title: "Supporter, billing and refunds",
    summary: "What Supporter includes, how billing works, and how refunds are handled.",
    minutes: 3,
    body: `
Supporter is the optional paid tier. It removes ads and adds a few extras, and it costs US$1.99 per month.

## What you get

- No ads anywhere in the panel.
- No four-hour session cap. A server with nobody on it for five minutes still sleeps, and the world stays saved.
- Priority start — you jump ahead when the node is full. Priority, not a guaranteed spot.
- +2 GB RAM on your server.
- A Supporter role in our Discord.
- One-click modpack installers, coming soon. Not in the panel yet.
- A player manager, coming soon. Not in the panel yet.

## Billing

Payments are handled by Stripe. We never see or store your full card number; we keep your subscription status and Stripe customer ID. The service itself stays free either way — Supporter is optional.

If you're under 18, you need a parent or guardian's OK before you subscribe.

## Canceling

Cancel any time through Stripe. Canceling stops the next charge, and you keep your Supporter perks until the end of the period you've already paid for.

## Refunds

- We don't give refunds for partial months.
- If you ask within 7 days of your first charge, we'll refund it in full.
- If we bill you by mistake, we'll always refund it.
- Refunds go back through Stripe to your original payment method.
- If you file a chargeback instead of contacting us first, we may remove Supporter from your account.

To ask for a refund, email support@opengamenode.com with your Discord username.

## Price changes

Prices may change. We'll tell Supporters before a change takes effect, and you can cancel before the next charge if you don't want to continue.

The full terms are in the [Terms of Service](/terms), section 5.
`,
  },
];

export function findGuide(slug: string): Guide | null {
  return guides.find((guide) => guide.slug === slug) ?? null;
}
