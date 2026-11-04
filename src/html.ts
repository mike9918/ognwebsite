import { content } from "./content";
import { guides, type Guide } from "./guides";
import { escapeHtml } from "./http";
import { renderMarkdown } from "./markdown";
import type { PublicEntry } from "./signup";

export type FormValues = {
  runType: string;
  runDetail: string;
  ref: string;
};

export type WishlistView = {
  discordEnabled: boolean;
  accepting: boolean;
  siteKey: string;
  values: FormValues;
  error: string | null;
  success: (PublicEntry & { discordInviteUrl: string | null }) | null;
};

type Current = "home" | "wishlist" | "faq" | "supporter" | "help" | "other";

function logo(): string {
  return `<a class="brand" href="/">
    <img
      src="/brand/opengamenode-dark.png"
      srcset="/brand/opengamenode-dark-960.png 960w, /brand/opengamenode-dark.png 2172w"
      sizes="240px"
      width="2172"
      height="724"
      alt="OpenGameNode"
      fetchpriority="high"
    >
  </a>`;
}

function header(current: Current): string {
  const items: { href: string; label: string; match: Current }[] = [
    { href: "/faq", label: content.nav.faq, match: "faq" },
    { href: "/supporter", label: content.nav.supporter, match: "supporter" },
    { href: "/help", label: content.nav.help, match: "help" },
  ];
  const links = items
    .map((item) => {
      const attr = current === item.match ? ` aria-current="page"` : "";
      return `<a href="${item.href}"${attr}>${escapeHtml(item.label)}</a>`;
    })
    .join("");
  return `<header class="site-header">
    <div class="frame header-inner">
      ${logo()}
      <nav aria-label="Site">
        ${links}
        <a href="${content.panelUrl}" rel="noopener">${escapeHtml(content.nav.panel)}</a>
      </nav>
    </div>
  </header>`;
}

function footer(inviteUrl: string | null): string {
  const discord = inviteUrl
    ? `<a href="${escapeHtml(inviteUrl)}" rel="noopener">Discord</a>`
    : "";
  return `<footer class="site-footer">
    <div class="frame footer-grid">
      <div class="footer-about">
        <p>${escapeHtml(content.footer.operator)}</p>
        <p class="footer-legal">
          ${escapeHtml(content.footer.minecraft)}
        </p>
      </div>
      <nav class="footer-links" aria-label="Footer">
        <a href="/">Home</a>
        <a href="/faq">${escapeHtml(content.nav.faq)}</a>
        <a href="/supporter">${escapeHtml(content.nav.supporter)}</a>
        <a href="/help">${escapeHtml(content.nav.help)}</a>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/aup">Acceptable use</a>
        ${discord}
      </nav>
    </div>
  </footer>`;
}

function layout(options: {
  title: string;
  description?: string;
  path: string;
  main: string;
  current: Current;
  inviteUrl: string | null;
  head?: string;
  scripts?: string;
}): string {
  const description = options.description ?? content.description;
  const canonical = `${content.siteOrigin}${options.path === "/" ? "" : options.path}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#0d1712">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(content.name)}">
  <meta property="og:title" content="${escapeHtml(options.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(content.siteOrigin)}/brand/og-default.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(content.name)} — ${escapeHtml(content.headline)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(options.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(content.siteOrigin)}/brand/og-default.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/styles.css">
  ${options.head ?? ""}
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  ${header(options.current)}
  <main id="content">${options.main}</main>
  ${footer(options.inviteUrl)}
  ${options.scripts ?? ""}
</body>
</html>`;
}

function heroCopy(): string {
  return `<p class="tagline">${escapeHtml(content.tagline)}</p>
    <h1>${escapeHtml(content.headline)}</h1>
    <p class="supporting">${escapeHtml(content.supporting)}</p>
    <p class="lede">${escapeHtml(content.home.lead)}</p>`;
}

function formHead(view: WishlistView): string {
  if (!(view.discordEnabled && view.accepting && view.siteKey)) return "";
  return `<script src="/wishlist.js" defer></script>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
}

function fieldError(error: string | null): string {
  if (!error) return "";
  return `<p id="form-alert" class="alert" role="alert">${escapeHtml(error)}</p>`;
}

function successBlock(entry: PublicEntry & { discordInviteUrl: string | null }): string {
  const discord = entry.discordInviteUrl
    ? `<p><a class="button button-secondary" href="${escapeHtml(entry.discordInviteUrl)}">${escapeHtml(content.success.discord)}</a></p>`
    : "";
  const existing = entry.existing ? `<p>${escapeHtml(content.success.existing)}</p>` : "";
  return `<section class="card success" aria-labelledby="success-heading">
    <h2 id="success-heading">${escapeHtml(content.success.heading)}</h2>
    ${existing}
    <p>${escapeHtml(content.success.reached.replace("{email}", entry.email))}</p>
    <p class="place">${escapeHtml(content.success.place.replace("{position}", String(entry.position)))}</p>
    <p>${escapeHtml(content.success.referral)}</p>
    <label for="referral-link">${escapeHtml(content.success.linkLabel)}</label>
    <input id="referral-link" readonly value="${escapeHtml(entry.referralUrl)}">
    <p class="note">${escapeHtml(content.success.screening)}</p>
    ${discord}
  </section>`;
}

function waitlistForm(view: WishlistView): string {
  const described = view.error ? ` aria-describedby="form-alert"` : "";
  const turnstile = view.siteKey
    ? `<p class="note" data-turnstile-status>Complete the check below, then continue.</p>
          <div
            class="cf-turnstile"
            data-sitekey="${escapeHtml(view.siteKey)}"
            data-action="signup"
            data-theme="dark"
            data-callback="__ognTurnstileSuccess"
            data-expired-callback="__ognTurnstileExpired"
            data-error-callback="__ognTurnstileError"
          ></div>`
    : `<p class="alert" role="alert">${escapeHtml(content.errors.unavailable)}</p>`;
  const selectedRun = view.values.runType || "vanilla";

  return `${fieldError(view.error)}
        <form id="waitlist-form" method="post" action="/api/auth/discord"${described}>
          <p class="note">${escapeHtml(content.form.intro)}</p>
          <fieldset>
            <legend>${escapeHtml(content.form.runLegend)}</legend>
            ${(["vanilla", "plugins", "modpack"] as const)
              .map((runType) => {
                const label =
                  runType === "vanilla"
                    ? content.form.vanilla
                    : runType === "plugins"
                      ? content.form.plugins
                      : content.form.modpack;
                const checked = selectedRun === runType ? " checked" : "";
                return `<label class="choice"><input type="radio" name="run_type" value="${runType}"${checked} required> <span>${escapeHtml(label)}</span></label>`;
              })
              .join("")}
          </fieldset>
          <div>
            <label for="run-detail">${escapeHtml(content.form.detailLabel)}</label>
            <input id="run-detail" name="run_detail" type="text" maxlength="120" value="${escapeHtml(view.values.runDetail)}">
          </div>
          <input type="hidden" name="ref" value="${escapeHtml(view.values.ref)}">
          ${turnstile}
          <div class="actions">
            <button class="button" type="submit" data-discord-submit disabled>${escapeHtml(content.form.discordButton)}</button>
          </div>
        </form>`;
}

function waitlistCard(view: WishlistView, heading = content.form.heading): string {
  let body: string;
  if (!view.accepting) {
    body = fieldError(view.error ?? content.errors.closed);
  } else if (!view.discordEnabled) {
    body = `<p class="alert" role="alert">${escapeHtml(content.errors.unavailable)}</p>`;
  } else {
    body = waitlistForm(view);
  }
  return `<section class="card waitlist-card" aria-labelledby="form-heading">
        <h2 id="form-heading">${escapeHtml(heading)}</h2>
        ${body}
      </section>`;
}

export function homePage(view: WishlistView, inviteUrl: string | null): string {
  const community = inviteUrl
    ? `<p class="actions"><a class="button button-secondary" href="${escapeHtml(inviteUrl)}" rel="noopener">${escapeHtml(content.home.joinDiscord)}</a></p>`
    : "";

  return layout({
    title: `${content.name} — ${content.headline}`,
    path: "/",
    current: "home",
    inviteUrl,
    head: formHead(view),
    main: `<div class="frame">
      <section class="hero-split">
        <div class="hero-copy">
          ${heroCopy()}
          <p class="note">${escapeHtml(content.minecraftNote)}</p>
        </div>
        <div class="hero-side">
          ${view.success ? successBlock(view.success) : waitlistCard(view, content.home.waitlistHeading)}
          <p class="note side-note">
            Prefer the panel? <a href="${content.panelUrl}" rel="noopener">${escapeHtml(content.nav.panel)}</a>
          </p>
        </div>
      </section>

      <section class="section" aria-labelledby="steps-heading">
        <h2 id="steps-heading">${escapeHtml(content.home.stepsHeading)}</h2>
        <p class="section-intro">${escapeHtml(content.home.stepsIntro)}</p>
        <ol class="steps">
          ${content.home.steps
            .map(
              (step, index) => `<li class="step">
            <span class="step-number" aria-hidden="true">${index + 1}</span>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.body)}</p>
          </li>`,
            )
            .join("")}
        </ol>
      </section>

      <section class="section" aria-labelledby="features-heading">
        <h2 id="features-heading">${escapeHtml(content.home.featuresHeading)}</h2>
        <div class="cards">
          ${content.home.features
            .map(
              (feature) => `<article class="card">
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`,
            )
            .join("")}
        </div>
        <ul class="facts">
          ${content.home.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
        </ul>
      </section>

      <section class="section" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">${escapeHtml(content.home.sessionsHeading)}</h2>
        <div class="cards">
          ${content.home.sessions
            .map(
              (item) => `<article class="card">
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.body)}</p>
          </article>`,
            )
            .join("")}
        </div>
      </section>

      <section class="section" aria-labelledby="games-heading">
        <h2 id="games-heading">${escapeHtml(content.home.gamesHeading)}</h2>
        <article class="card game-card">
          <h3>Minecraft</h3>
          <p>${escapeHtml(content.home.gamesBody)}</p>
        </article>
      </section>

      <section class="section" aria-labelledby="supporter-teaser">
        <article class="card supporter-teaser">
          <div>
            <h2 id="supporter-teaser">${escapeHtml(content.supporter.heading)}</h2>
            <p>${escapeHtml(content.home.supporterBody)}</p>
          </div>
          <p class="price-inline">${escapeHtml(content.supporter.price)}<span>${escapeHtml(content.supporter.period)}</span></p>
          <p class="actions"><a class="button button-secondary" href="/supporter">${escapeHtml(content.home.supporterLink)}</a></p>
        </article>
      </section>

      <section class="section" aria-labelledby="faq-heading">
        <h2 id="faq-heading">${escapeHtml(content.home.faqHeading)}</h2>
        <div class="faq">
          ${content.faq
            .slice(0, 4)
            .map(
              (item) => `<details>
            <summary>${escapeHtml(item.question)}</summary>
            <p>${escapeHtml(item.answer)}</p>
          </details>`,
            )
            .join("")}
        </div>
        <p class="actions"><a class="button button-secondary" href="/faq">${escapeHtml(content.home.faqMore)}</a></p>
      </section>

      <section class="section" aria-labelledby="community-heading">
        <h2 id="community-heading">${escapeHtml(content.home.communityHeading)}</h2>
        <p class="section-intro">${escapeHtml(content.home.communityBody)}</p>
        ${community}
      </section>
    </div>`,
  });
}

export function wishlistPage(view: WishlistView, inviteUrl: string | null): string {
  if (view.success) {
    return layout({
      title: `${content.success.heading} ${content.name}`,
      description: content.success.heading,
      path: "/wishlist",
      current: "wishlist",
      inviteUrl,
      main: `<div class="frame stack">${successBlock(view.success)}</div>`,
    });
  }

  return layout({
    title: `${content.form.heading} · ${content.name}`,
    description: content.description,
    path: "/wishlist",
    current: "wishlist",
    inviteUrl,
    head: formHead(view),
    main: `<div class="frame stack">
      <section class="hero">
        ${heroCopy()}
      </section>
      ${waitlistCard(view)}
      <section aria-labelledby="features-heading">
        <h2 id="features-heading">${escapeHtml(content.home.featuresHeading)}</h2>
        <p class="note">${escapeHtml(content.minecraftNote)}</p>
        <div class="cards">
          ${content.home.features
            .map(
              (feature) => `<article class="card">
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`,
            )
            .join("")}
        </div>
        <ul class="facts">
          ${content.home.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
        </ul>
      </section>
      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">${escapeHtml(content.home.faqHeading)}</h2>
        <div class="faq">
          ${content.faq
            .slice(0, 4)
            .map(
              (item) => `<details>
            <summary>${escapeHtml(item.question)}</summary>
            <p>${escapeHtml(item.answer)}</p>
          </details>`,
            )
            .join("")}
        </div>
        <p class="actions"><a class="button button-secondary" href="/faq">${escapeHtml(content.home.faqMore)}</a></p>
      </section>
    </div>`,
  });
}

export function faqPage(inviteUrl: string | null): string {
  return layout({
    title: `Questions · ${content.name}`,
    description: "How OpenGameNode servers work: session times, ads, the queue, Supporter, and who can use it.",
    path: "/faq",
    current: "faq",
    inviteUrl,
    main: `<div class="frame stack">
      <section class="hero">
        <p class="tagline">${escapeHtml(content.home.faqHeading)}</p>
        <h1>How OpenGameNode works</h1>
        <p class="supporting">Short answers about sessions, ads, Supporter and sign-up.</p>
      </section>
      <div class="faq">
        ${content.faq
          .map(
            (item) => `<details>
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>`,
          )
          .join("")}
      </div>
      <section class="card">
        <h2>Still stuck?</h2>
        <p>Ask in our Discord or email <a href="mailto:support@opengamenode.com">support@opengamenode.com</a>. Short how-tos live in the <a href="/help">help guides</a>.</p>
        <p class="actions"><a class="button" href="/">${escapeHtml(content.home.primaryAction)}</a></p>
      </section>
    </div>`,
  });
}

export function supporterPage(inviteUrl: string | null): string {
  return layout({
    title: `${content.supporter.heading} · ${content.name}`,
    description: "OpenGameNode Supporter is $1.99/month: no ads, priority start, +1 GB RAM and a Discord role. Cancel anytime.",
    path: "/supporter",
    current: "supporter",
    inviteUrl,
    main: `<div class="frame stack">
      <section class="hero">
        <p class="tagline">${escapeHtml(content.supporter.tagline)}</p>
        <h1>${escapeHtml(content.supporter.heading)}</h1>
        <p class="supporting">${escapeHtml(content.supporter.lead)}</p>
      </section>
      <section class="card price-card" aria-labelledby="price-heading">
        <h2 id="price-heading" class="price">${escapeHtml(content.supporter.price)}<span class="price-period">${escapeHtml(content.supporter.period)}</span></h2>
        <ul class="perks">
          ${content.supporter.perks.map((perk) => `<li>${escapeHtml(perk)}</li>`).join("")}
        </ul>
        <p class="actions">
          <button class="button" type="button" disabled>${escapeHtml(content.supporter.cta)}</button>
        </p>
        <p class="note">${escapeHtml(content.supporter.ctaNote)}</p>
      </section>
      <section class="card" aria-labelledby="billing-heading">
        <h2 id="billing-heading">Billing</h2>
        <p>${escapeHtml(content.supporter.billing)}</p>
        <h3>Refunds</h3>
        <ul class="perks">
          ${content.supporter.refunds.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
        <p>${escapeHtml(content.supporter.age)}</p>
        <p class="note">${escapeHtml(content.supporter.adNote)}</p>
      </section>
      <section class="card">
        <h2>The free tier stays free</h2>
        <p>Every server is free. Supporter is optional and only removes ads and adds the extras above. The free plan keeps its own limits — Supporter doesn't unlock features that don't exist yet.</p>
        <p class="actions">
          <a class="button button-secondary" href="/">${escapeHtml(content.home.primaryAction)}</a>
          <a class="button button-secondary" href="/faq">Read the questions</a>
        </p>
      </section>
    </div>`,
  });
}

export function helpIndexPage(inviteUrl: string | null): string {
  return layout({
    title: `${content.help.heading} · ${content.name}`,
    description: "Short guides for starting a server, inviting friends, uploading a world, keeping backups and Supporter billing.",
    path: "/help",
    current: "help",
    inviteUrl,
    main: `<div class="frame stack">
      <section class="hero">
        <p class="tagline">${escapeHtml(content.help.tagline)}</p>
        <h1>${escapeHtml(content.help.heading)}</h1>
        <p class="supporting">${escapeHtml(content.help.intro)}</p>
      </section>
      <ul class="guide-list">
        ${guides
          .map(
            (guide) => `<li class="card">
          <h2><a href="/help/${guide.slug}">${escapeHtml(guide.title)}</a></h2>
          <p>${escapeHtml(guide.summary)}</p>
          <p class="note">${guide.minutes} min read</p>
        </li>`,
          )
          .join("")}
      </ul>
      <p class="note">${escapeHtml(content.help.more)}</p>
    </div>`,
  });
}

export function guidePage(guide: Guide, inviteUrl: string | null): string {
  return layout({
    title: `${guide.title} · ${content.name} help`,
    description: guide.summary,
    path: `/help/${guide.slug}`,
    current: "help",
    inviteUrl,
    main: `<div class="frame stack">
      <p class="breadcrumb"><a href="/help">${escapeHtml(content.help.back)}</a></p>
      <article class="prose card">
        <h1>${escapeHtml(guide.title)}</h1>
        <p class="note">${guide.minutes} min read</p>
        ${renderMarkdown(guide.body)}
      </article>
      <p class="actions">
        <a class="button button-secondary" href="/help">${escapeHtml(content.help.back)}</a>
        <a class="button" href="/">${escapeHtml(content.home.primaryAction)}</a>
      </p>
    </div>`,
  });
}

export function legalPage(
  doc: { title: string; body: string; path: string },
  inviteUrl: string | null,
): string {
  return layout({
    title: `${doc.title} · ${content.name}`,
    description: `${doc.title} for OpenGameNode.`,
    path: doc.path,
    current: "other",
    inviteUrl,
    main: `<div class="frame stack">
      <article class="prose card">
        <h1>${escapeHtml(doc.title)}</h1>
        <p class="note">${escapeHtml(content.legal.updatedLabel)} ${escapeHtml(content.legal.updated)}</p>
        ${renderMarkdown(doc.body)}
      </article>
    </div>`,
  });
}

export function textPage(title: string, body: string, inviteUrl: string | null): string {
  return layout({
    title: `${title} · ${content.name}`,
    description: body,
    path: "/",
    current: "other",
    inviteUrl,
    main: `<div class="frame stack">
      <article class="card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(body)}</p>
      </article>
    </div>`,
  });
}

export function notFoundPage(inviteUrl: string | null): string {
  return layout({
    title: `${content.notFound.title} ${content.name}`,
    description: content.notFound.body,
    path: "/404",
    current: "other",
    inviteUrl,
    main: `<div class="frame hero">
      <h1>${escapeHtml(content.notFound.title)}</h1>
      <p class="supporting">${escapeHtml(content.notFound.body)}</p>
      <p><a class="button" href="/">${escapeHtml(content.notFound.home)}</a></p>
    </div>`,
  });
}
