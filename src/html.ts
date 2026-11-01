import { content, type RunType } from "./content";
import { escapeHtml, jsonScript } from "./http";
import type { PublicEntry } from "./signup";

export type FormValues = {
  email: string;
  discordUsername: string;
  runType: string;
  runDetail: string;
  ref: string;
};

export type WishlistView = {
  discordEnabled: boolean;
  siteKey: string;
  values: FormValues;
  error: string | null;
  success: (PublicEntry & { discordInviteUrl: string | null }) | null;
};

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

function header(current: "home" | "wishlist" | "other"): string {
  const currentAttr = current === "wishlist" ? ` aria-current="page"` : "";
  return `<header class="site-header">
    <div class="frame header-inner">
      ${logo()}
      <nav aria-label="Site">
        <a href="/wishlist"${currentAttr}>${escapeHtml(content.navWaitlist)}</a>
      </nav>
    </div>
  </header>`;
}

function footer(): string {
  return `<footer class="site-footer">
    <div class="frame">
      <p>${escapeHtml(content.footerDisclaimer)}</p>
      <p class="footer-meta">
        <span>${escapeHtml(content.copyright)}</span>
        <a href="/terms">${escapeHtml(content.termsLink)}</a>
        <a href="/privacy">${escapeHtml(content.privacyLink)}</a>
      </p>
    </div>
  </footer>`;
}

function layout(options: {
  title: string;
  main: string;
  current: "home" | "wishlist" | "other";
  head?: string;
  scripts?: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(content.description)}">
  <meta name="theme-color" content="#0d1712">
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
  ${footer()}
  ${options.scripts ?? ""}
</body>
</html>`;
}

function hero(): string {
  return `<p class="tagline">${escapeHtml(content.tagline)}</p>
    <h1>${escapeHtml(content.headline)}</h1>
    <p class="supporting">${escapeHtml(content.supporting)}</p>`;
}

export function homePage(): string {
  return layout({
    title: content.name,
    current: "home",
    main: `<div class="frame hero">
      ${hero()}
      <p><a class="button" href="/wishlist">${escapeHtml(content.primaryAction)}</a></p>
      <p class="note">${escapeHtml(content.minecraftNote)}</p>
    </div>`,
  });
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
    ${discord}
  </section>`;
}

export function wishlistPage(view: WishlistView): string {
  if (view.success) {
    return layout({
      title: `${content.success.heading} ${content.name}`,
      current: "wishlist",
      main: `<div class="frame stack">${successBlock(view.success)}</div>`,
    });
  }

  const described = view.error ? ` aria-describedby="form-alert"` : "";
  const turnstile = view.siteKey
    ? `<div class="cf-turnstile" data-sitekey="${escapeHtml(view.siteKey)}" data-action="signup" data-theme="dark"></div>`
    : `<p class="alert" role="alert">${escapeHtml(content.errors.unavailable)}</p>`;
  const discord = view.discordEnabled
    ? `<button class="button button-secondary" type="submit" formaction="/api/auth/discord">${escapeHtml(content.form.discordButton)}</button>`
    : "";
  const head = view.siteKey
    ? `<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`
    : "";
  const copy = {
    successHeading: content.success.heading,
    existing: content.success.existing,
    reached: content.success.reached,
    place: content.success.place,
    referral: content.success.referral,
    linkLabel: content.success.linkLabel,
    copy: content.success.copy,
    copied: content.success.copied,
    discord: content.success.discord,
    generic: content.errors.generic,
  };

  return layout({
    title: `${content.form.heading} · ${content.name}`,
    current: "wishlist",
    head,
    scripts: `${jsonScript("waitlist-copy", copy)}
<script src="/wishlist.js" defer></script>`,
    main: `<div class="frame stack">
      <section class="hero">
        ${hero()}
      </section>
      <section class="card" aria-labelledby="form-heading">
        <h2 id="form-heading">${escapeHtml(content.form.heading)}</h2>
        ${fieldError(view.error)}
        <form id="waitlist-form" method="post" action="/api/waitlist"${described}>
          <div>
            <label for="email">${escapeHtml(content.form.emailLabel)}</label>
            <input id="email" name="email" type="email" autocomplete="email" maxlength="254" spellcheck="false" required value="${escapeHtml(view.values.email)}">
          </div>
          <div>
            <label for="discord-username">${escapeHtml(content.form.discordLabel)}</label>
            <input id="discord-username" name="discord_username" type="text" maxlength="32" autocomplete="off" value="${escapeHtml(view.values.discordUsername)}">
          </div>
          <fieldset>
            <legend>${escapeHtml(content.form.runLegend)}</legend>
            ${(["vanilla", "plugins", "modpack"] as RunType[])
              .map((runType) => {
                const label =
                  runType === "vanilla"
                    ? content.form.vanilla
                    : runType === "plugins"
                      ? content.form.plugins
                      : content.form.modpack;
                const checked = view.values.runType === runType ? " checked" : "";
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
            <button class="button" type="submit" data-email-submit>${escapeHtml(content.form.submit)}</button>
            ${discord}
          </div>
        </form>
      </section>
      <section aria-labelledby="features-heading">
        <h2 id="features-heading">${escapeHtml(content.featuresHeading)}</h2>
        <p class="note">${escapeHtml(content.featuresIntro)}</p>
        <div class="cards">
          ${content.features
            .map(
              (feature) => `<article class="card">
            <h3>${escapeHtml(feature.title)}</h3>
            <p>${escapeHtml(feature.body)}</p>
          </article>`,
            )
            .join("")}
        </div>
        <ul class="facts">
          ${content.facts.map((fact) => `<li>${escapeHtml(fact)}</li>`).join("")}
        </ul>
      </section>
      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">${escapeHtml(content.faqHeading)}</h2>
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
      </section>
    </div>`,
  });
}

export function textPage(title: string, body: string): string {
  return layout({
    title: `${title} · ${content.name}`,
    current: "other",
    main: `<div class="frame stack">
      <article class="card">
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(body)}</p>
      </article>
    </div>`,
  });
}

export function notFoundPage(): string {
  return layout({
    title: `${content.notFound.title} ${content.name}`,
    current: "other",
    main: `<div class="frame hero">
      <h1>${escapeHtml(content.notFound.title)}</h1>
      <p class="supporting">${escapeHtml(content.notFound.body)}</p>
      <p><a class="button" href="/">${escapeHtml(content.notFound.home)}</a></p>
    </div>`,
  });
}
