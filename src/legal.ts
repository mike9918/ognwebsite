// Approved legal text. Mirrors content/legal/*.md in the repo, which are the
// drafts Michael signed off on. The draft-review note, the "Last updated"
// placeholder and the trailing disclaimer lines are handled by the page
// template and the site footer, so they are not repeated here.

export const legalDoc = (body: string): string => body.trim();

export const termsBody = legalDoc(`
Welcome to OpenGameNode. These terms are the deal between you and OpenGameNode ("we", "us"). By signing in or using the service, you accept them. If you do not accept them, do not use the service.

## 1. Who we are

OpenGameNode is a free, ad-supported Minecraft server hosting service at opengamenode.com. Servers are managed through the web panel at panel.opengamenode.com. Discord is used for sign-in, community and support only.

OpenGameNode is operated by MH Tech Solutions.

- Mailing address: 891 E High St, Bryan, OH 43506
- Support: support@opengamenode.com
- Abuse and admin: admin@opengamenode.com

OpenGameNode is not an official Minecraft product, and is not approved by or associated with Mojang or Microsoft.

## 2. Who can use it

You must be at least 16 if you live in the European Union or European Economic Area, and at least 13 everywhere else. If you're under 18, you need a parent or guardian to agree to these terms for you, and a parent or guardian must approve any Supporter purchase.

You must have a Discord account and sign in through Discord. You are responsible for everything that happens on your account, and for keeping access to your Discord account and panel sign-in secure. One account per person.

You're signed out of the panel after about one hour of inactivity. Your servers keep running while you're signed out.

## 3. How the service works

The service runs on a best-effort basis. It is free and ad-supported, and we do not promise that it will be available at any particular time.

- On the free plan, each Start gives a session of about four hours.
- In the last ten minutes of a free session, the owner can click Extend to add about four more hours. Extend can be used twice per day.
- A Supporter server is not limited to a four-hour session.
- If nobody is on a server for about five minutes, it shuts off and its session is canceled. The timer does not keep running. A player joining won't start it again. The owner clicks Start again to begin a fresh session.
- When a session ends, the server shuts off until the owner clicks Start.
- Worlds and files are kept between sessions unless removed under these terms.
- A server queues only if 4 others are already starting or the node is full. Supporters get priority, which is not a guaranteed spot.
- Ads are display ads on panel pages only. You never have to watch an ad to start a server.
- Capacity, session length, queue rules, features and limits may change. Where a change is significant, we'll try to announce it on our site or Discord first.

We may remove servers, worlds or files belonging to accounts that have been inactive for a long time. Please keep your own backups. We do not promise that any backup we may make will exist, be complete or be restorable.

## 4. Your content

You keep whatever rights you have in the worlds, files, configurations, logs and other content you upload or generate ("your content"). You give us a worldwide, royalty-free, non-exclusive licence to store, copy, back up, transmit, display and process your content only for the purpose of running and supporting the service. You confirm you have the rights needed to upload it.

You are responsible for your content.

## 5. Supporter tier

The Supporter tier costs US$1.99 per month and is billed by Stripe. It currently includes no ads, no four-hour session cap, priority start (priority, not guaranteed), +2 GB RAM and a Discord Supporter role. One-click modpack installers and a player manager are planned and are not included until they are available in the panel. Perks may be added, changed or removed. You can cancel at any time through Stripe. Canceling stops the next charge, and you keep your Supporter perks until the end of the period you've already paid for.

**Refunds:**

- We don't give refunds for partial months.
- If you ask within 7 days of your first charge, we'll refund it in full.
- If we bill you by mistake, we'll always refund it.
- Refunds go back through Stripe to your original payment method. To ask for one, email support@opengamenode.com.
- If you file a chargeback instead of contacting us first, we may remove Supporter from your account.

If you're under 18, a parent or guardian must approve the purchase.

Prices may change. We'll tell Supporters before a price change takes effect, and you can cancel before the next charge if you don't want to continue.

## 6. Acceptable use

Your use must follow our Acceptable Use Policy, which forms part of these terms.

## 7. Suspension, deletion and appeals

We may warn, restrict, suspend or delete an account, server, world, file or content:

- if it breaks these terms or the Acceptable Use Policy;
- if it involves illegal content; or
- where needed to protect the service, our other users or anyone else.

Where reasonable, we'll give you notice and a chance to download your world and files first. We won't do that for serious abuse, such as child sexual abuse material (CSAM), attacks on us or others, or malware. In those cases we act immediately.

We may report content and account details to law enforcement or platform providers where the law requires it or where we believe it is needed to prevent harm.

**Appeals:** if you think we got it wrong, email support@opengamenode.com with your Discord username and the server involved. A person will review it.

You may stop using the service at any time. We may stop providing it, in whole or in part. If we shut the service down, we'll try to give reasonable notice so you can download your worlds.

## 8. No warranty

To the fullest extent the law allows, the service and everything on it are provided **"as is" and "as available"**, with no warranty of any kind, whether express or implied, including any warranty of uptime, availability, performance, security, fitness for a purpose, non-infringement, or that data will be stored, kept, backed up or recoverable. We do not control or endorse anything users upload.

## 9. Limitation of liability

To the fullest extent the law allows:

**The Covered Parties are not liable for any indirect, incidental, special, consequential, exemplary or punitive damages**, or for lost profits, revenue, goodwill or data, arising out of or relating to the service, even if told about the possibility of that loss.

**The Covered Parties' total liability** for all claims relating to the service is limited to the greater of (a) the amount you paid us in the three months before the claim, or (b) US$10.

"Covered Parties" means OpenGameNode, MH Tech Solutions, its owner, staff and volunteers.

**Indemnity:** you will defend and indemnify the Covered Parties against claims brought by third parties arising from your content or your breach of these terms or the Acceptable Use Policy, including reasonable legal fees.

## 10. Changes to these terms

We may update these terms by posting a new version on the site and changing the "Last updated" date. For significant changes, we'll also try to announce them on our site or Discord. Continued use after a change means you accept it.

**Governing law and venue:** These terms are governed by the laws of the State of Ohio. Any dispute relating to these terms or the service will be handled in the state or federal courts located in Ohio.

## 11. General

If any part of these terms is found unenforceable, the rest stays in force. Nothing in these terms limits any liability that cannot legally be limited, or removes any right that cannot legally be waived. These terms, the Acceptable Use Policy and the Privacy Policy are the whole agreement. We do not waive any right by not enforcing it once. You may not transfer your rights under these terms; we may transfer ours as part of a sale or transfer of the service.

## 12. Contact

891 E High St, Bryan, OH 43506. Support: support@opengamenode.com. Abuse and admin: admin@opengamenode.com.
`);

export const privacyBody = legalDoc(`
This is the short version of what OpenGameNode keeps and why.

## Who we are

OpenGameNode is operated by MH Tech Solutions. Mailing address: 891 E High St, Bryan, OH 43506. For privacy questions or requests, email support@opengamenode.com.

## What we keep

- **Discord sign-in:** your Discord user ID, username, display name, avatar and email address. We use your email for your account and to contact you about the service.
- **Your servers:** worlds, files, configurations, and console and connection logs.
- **Technical data:** IP addresses, timestamps and basic connection and security logs.
- **Payments (Supporters):** subscription status and Stripe customer ID. Card details go to Stripe; we never see or store full card numbers.
- **Ads:** see the ads section below.

## Why we keep it

To run your servers, keep you signed in, provide support, take payments, keep the service secure, prevent abuse, and show the ads that keep the service free.

## Cookies

We use a session cookie so you stay signed in to the panel. Google and its partners also use cookies for ads, as described below. You can block or clear cookies in your browser, but the panel may stop working.

## Ads

We show Google AdSense display ads on panel pages. Google's required disclosure:

> Third party vendors, including Google, use cookies to serve ads based on your prior visits to this and other websites. Google's use of advertising cookies lets it and its partners serve ads to you based on your visits to this site and/or other sites on the internet. You can opt out of personalised advertising by visiting Google's Ads Settings. You can also opt out of third-party vendors' use of cookies for personalised advertising at www.aboutads.info. See Google's partner sites policy at policies.google.com/technologies/partner-sites.

Visitors in the EEA, UK and Switzerland are shown a consent message. Where consent is refused, ads are limited to non-personalised.

## Sharing

We don't sell your personal data for money. We share what is needed with the providers that make the service work — Discord, Stripe, Google, and our hosting, proxy and network providers — and with others where the law requires it, or where we believe it is needed to prevent harm or abuse. If the service is sold or transferred, your data may move with it, under this policy.

## US state privacy rights

Some US state laws, such as California's, may treat personalized advertising through Google AdSense as "selling" or "sharing" personal information. You can opt out of this at any time by:

- choosing your options in the consent message on our site;
- turning off personalized ads in Google's Ads Settings (adssettings.google.com); or
- sending a Global Privacy Control (GPC) signal from your browser. We honor GPC signals as an opt-out.

Depending on your state, you may also have the right to know what we hold about you, and to correct or delete it. Email support@opengamenode.com. We won't treat you differently for using these rights.

## Keeping and deleting

We keep data only as long as we need it for the reasons above. Rough retention periods:

- **Connection and security logs:** about 90 days.
- **Account data and your servers:** while your account is active.
- **Payment records:** as long as required for tax and accounting.

To request a copy or deletion of your data, email support@opengamenode.com. Deleting your account deletes your servers and files; some records, such as payment and abuse records, may be kept as described above.

## Children

The service is for people aged 16 and over in the European Union and European Economic Area, and 13 and over everywhere else. We do not knowingly collect data from anyone below that minimum age; if we learn we have, we'll delete it. If you're under 18, you need a parent or guardian's OK to use the service and to buy Supporter.

## Your rights

Depending on where you live, you may have rights to access, correct, delete, restrict or object to our use of your data, and to complain to a data protection authority. Email support@opengamenode.com. We may need to confirm who you are. You can also use the opt-out options in the ads and US state privacy sections.

## Changes

We may change this policy by posting an updated version and changing the "Last updated" date. For significant changes, we'll also try to announce them on our site or Discord.
`);

export const aupBody = legalDoc(`
This policy is part of our Terms of Service. It covers what you may not do with OpenGameNode servers, accounts or network. If you are not sure whether something is allowed, ask before you do it at support@opengamenode.com or in our Discord.

## Do not

- Mine cryptocurrency, or use the service for anything other than Minecraft.
- Run non-game workloads, proxies, VPNs, tunnels, or file hosting or storage services.
- Launch or take part in attacks, including DDoS, port scanning, flooding, or attacking anything from or through our servers.
- Upload or host illegal content, including child sexual abuse material, malware, phishing pages, or stolen data.
- Harass, threaten, dox, impersonate, or post hateful content.
- Break the Minecraft EULA or Mojang's brand and usage guidelines.
- Abuse the free tier: extra accounts to get round limits, bots or scripts that keep servers online to dodge the empty-server shutoff or session timer, automating the panel, or reselling or subletting capacity.
- Try to break or get round our sessions, queues, limits or security, or probe or interfere with other users' servers, accounts or data. Ad blockers are fine.

## Enforcement

If you break this policy, we may warn, restrict, suspend or delete the account, server, world or content involved, as set out in section 7 of the Terms of Service. Where reasonable, we'll give notice and a chance to download your world first, except for serious abuse such as CSAM, attacks or malware. We may report illegal content to law enforcement or platform providers where the law requires it or where we believe it is needed to prevent harm.

To appeal a decision, email support@opengamenode.com.

## Reporting abuse

Report abuse to admin@opengamenode.com. Include the server, account and what happened.

---

Operated by MH Tech Solutions.
`);
