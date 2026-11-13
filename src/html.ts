import { content } from "./content";
import { guides, type Guide } from "./guides";
import { escapeHtml } from "./http";
import { renderMarkdown } from "./markdown";
import { SERVER_PLANS } from "./plans";
import { descriptions, jsonLdScript, pageStructuredData, titles } from "./seo";
import type { PublicEntry } from "./signup";

export type FormValues = {
  runType: string;
  runDetail: string;
};

// "open" shows the form, "full" swaps it for the at-capacity message, "closed"
// is the maintenance switch. The cap value itself is never rendered.
export type Capacity = "open" | "full" | "closed";

export type WishlistView = {
  discordEnabled: boolean;
  capacity: Capacity;
  // Drives preparing copy on the success screen (Automatic vs Manual).
  autoProvision: boolean;
  siteKey: string;
  values: FormValues;
  error: string | null;
  success: (PublicEntry & { discordInviteUrl: string | null }) | null;
};

type Current = "home" | "wishlist" | "faq" | "supporter" | "help" | "minecraft" | "other";

type Crumb = { name: string; path: string };

function gb(mib: number): string {
  return `${Math.round(mib / 1024)} GB`;
}

function threads(percent: number): string {
  const count = percent / 100;
  const label = count === 1 ? "thread" : "threads";
  return `${count} CPU ${label}`;
}

function logo(): string {
  return `<a class="brand" href="/">
    <img
      src="/brand/opengamenode-dark.png"
      srcset="/brand/opengamenode-dark-960.png 960w, /brand/opengamenode-dark.png 2172w"
      sizes="(min-width: 720px) 132px, 108px"
      width="2172"
      height="724"
      alt="OpenGameNode"
      fetchpriority="high"
    >
  </a>`;
}

function header(current: Current): string {
  const items: { href: string; label: string; match: Current }[] = [
    { href: "/free-minecraft-server", label: content.nav.minecraft, match: "minecraft" },
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
  const signupHref = current === "home" ? "#signup" : "/signup";
  return `<header class="site-header">
    <div class="frame header-inner">
      ${logo()}
      <nav aria-label="Site">
        ${links}
        <a href="${content.panelUrl}" rel="noopener">${escapeHtml(content.nav.panel)}</a>
        <a class="nav-cta" href="${signupHref}">${escapeHtml(content.nav.signup)}</a>
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
        <p class="footer-brand">${escapeHtml(content.name)}</p>
        <p>${escapeHtml(content.tagline)}</p>
        <p>${escapeHtml(content.footer.nameLine)}</p>
        <p>${escapeHtml(content.footer.operator)}</p>
        <p class="footer-legal">
          ${escapeHtml(content.footer.minecraft)}
        </p>
      </div>
      <nav class="footer-links" aria-label="Product">
        <p class="footer-heading">Product</p>
        <a href="/free-minecraft-server">Free Minecraft server</a>
        <a href="/signup">Sign up</a>
        <a href="/supporter">${escapeHtml(content.nav.supporter)}</a>
        <a href="/faq">${escapeHtml(content.nav.faq)}</a>
        <a href="${content.panelUrl}" rel="noopener">${escapeHtml(content.nav.panel)}</a>
      </nav>
      <nav class="footer-links" aria-label="Help">
        <p class="footer-heading">Help</p>
        <a href="/help">${escapeHtml(content.help.heading)}</a>
        <a href="/help/first-server">Start a server</a>
        <a href="/help/invite-friends">Invite friends</a>
        <a href="/help/upload-a-world">Upload a world</a>
        <a href="/help/backups">Backups</a>
      </nav>
      <nav class="footer-links" aria-label="Policies">
        <p class="footer-heading">Policies</p>
        <a href="/terms">Terms</a>
        <a href="/privacy">Privacy</a>
        <a href="/aup">Acceptable use</a>
        ${discord}
      </nav>
    </div>
  </footer>`;
}

function breadcrumbs(items: readonly Crumb[]): string {
  if (!items.length) return "";
  const parts = items
    .map((item, index) => {
      const last = index === items.length - 1;
      if (last) return `<li aria-current="page">${escapeHtml(item.name)}</li>`;
      return `<li><a href="${escapeHtml(item.path)}">${escapeHtml(item.name)}</a></li>`;
    })
    .join("");
  return `<nav class="breadcrumb" aria-label="Breadcrumb"><ol>${parts}</ol></nav>`;
}

function faqList(items: readonly { question: string; answer: string }[]): string {
  return `<div class="faq">${items
    .map(
      (item) => `<details>
        <summary>${escapeHtml(item.question)}</summary>
        <p>${escapeHtml(item.answer)}</p>
      </details>`,
    )
    .join("")}</div>`;
}

function statRow(): string {
  const vanilla = SERVER_PLANS.vanilla;
  const modpack = SERVER_PLANS.modpack;
  const stats = [
    { term: "Vanilla and Paper", value: `${gb(vanilla.memoryMiB)} RAM` },
    { term: "Modpack", value: `${gb(modpack.memoryMiB)} RAM` },
    { term: "Disk", value: gb(vanilla.diskMiB) },
    { term: "Each Start", value: "About 4 hours" },
  ];
  return `<dl class="stat-row">${stats
    .map(
      (stat) => `<div>
        <dt>${escapeHtml(stat.term)}</dt>
        <dd>${escapeHtml(stat.value)}</dd>
      </div>`,
    )
    .join("")}</dl>`;
}

function serverTypeCards(): string {
  return `<div class="cards type-grid">${content.home.serverTypes
    .map((type) => {
      const plan = SERVER_PLANS[type.runType];
      return `<article class="card type-card">
        <img src="${type.image}" alt="${escapeHtml(type.imageAlt)}" width="${type.width}" height="${type.height}" loading="lazy" decoding="async">
        <p class="kicker">Minecraft Java</p>
        <h3>${escapeHtml(type.title)}</h3>
        <p class="type-spec">${escapeHtml(gb(plan.memoryMiB))} RAM · ${escapeHtml(threads(plan.cpuPercent))}</p>
        <p>${escapeHtml(type.body)}</p>
      </article>`;
    })
    .join("")}</div>`;
}

function specTable(): string {
  const rows = (
    [
      ["vanilla", "Plain Minecraft Java"],
      ["plugins", "Paper plugins"],
      ["modpack", "A curated modpack"],
    ] as const
  )
    .map(([runType, use]) => {
      const plan = SERVER_PLANS[runType];
      const name = runType === "plugins" ? "Plugins (Paper)" : plan.label;
      return `<tr>
        <th scope="row">${escapeHtml(name)}</th>
        <td>${escapeHtml(gb(plan.memoryMiB))}</td>
        <td>${escapeHtml(threads(plan.cpuPercent))}</td>
        <td>${escapeHtml(gb(plan.diskMiB))}</td>
        <td>${escapeHtml(use)}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap">
    <table class="spec-table">
      <caption>Free Minecraft Java server limits</caption>
      <thead>
        <tr>
          <th scope="col">Plan</th>
          <th scope="col">RAM</th>
          <th scope="col">CPU</th>
          <th scope="col">Disk</th>
          <th scope="col">Best for</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
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
  robots?: string;
  breadcrumbs?: readonly Crumb[];
  faq?: readonly { question: string; answer: string }[];
  service?: boolean;
}): string {
  const description = options.description ?? descriptions.home;
  const canonical = `${content.siteOrigin}${options.path === "/" ? "" : options.path}`;
  const robots =
    options.robots ?? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
  const structured = robots.includes("noindex")
    ? ""
    : jsonLdScript(
        pageStructuredData({
          title: options.title,
          description,
          path: options.path,
          inviteUrl: options.inviteUrl,
          breadcrumbs: options.breadcrumbs,
          faq: options.faq,
          service: options.service,
        }),
      );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(options.title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#0d1712">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="en_US">
  <meta property="og:site_name" content="${escapeHtml(content.name)}">
  <meta property="og:title" content="${escapeHtml(options.title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:image" content="${escapeHtml(content.siteOrigin)}/brand/og-default.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(content.name)} — free Minecraft server hosting">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(options.title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(content.siteOrigin)}/brand/og-default.png">
  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" href="/favicon-32.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="stylesheet" href="/styles.css">
  ${structured}
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
  return `<p class="eyebrow">${escapeHtml(content.name)}</p>
    <h1>${escapeHtml(content.headline)}</h1>
    <p class="supporting">${escapeHtml(content.supporting)}</p>
    <p class="lede">${escapeHtml(content.home.lead)}</p>`;
}

function platformStrip(): string {
  const items = content.home.platforms
    .map(
      (platform) => `<li class="platform-chip">
        <img src="${platform.image}" alt="" width="${platform.width}" height="${platform.height}" decoding="async">
        <span>${escapeHtml(platform.name)}</span>
      </li>`,
    )
    .join("");
  return `<div class="platform-strip" aria-label="${escapeHtml(content.home.platformsHeading)}">
    <p class="platform-strip-label">${escapeHtml(content.home.platformsHeading)}</p>
    <ul class="platform-list">${items}</ul>
  </div>`;
}

function formHead(view: WishlistView): string {
  if (view.capacity !== "open" || !view.discordEnabled || !view.siteKey) return "";
  return `<link rel="preconnect" href="https://challenges.cloudflare.com">
      <script src="/wishlist.js" defer></script>
      <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`;
}

function fieldError(error: string | null): string {
  if (!error) return "";
  return `<p id="form-alert" class="alert" role="alert">${escapeHtml(error)}</p>`;
}

function successBlock(
  entry: PublicEntry & { discordInviteUrl: string | null },
  autoProvision: boolean,
): string {
  const discord = entry.discordInviteUrl
    ? `<p><a class="button button-secondary" href="${escapeHtml(entry.discordInviteUrl)}">${escapeHtml(content.success.discord)}</a></p>`
    : "";
  const existing = entry.existing ? `<p>${escapeHtml(content.success.existing)}</p>` : "";
  const preparing = autoProvision
    ? content.success.preparingAutomatic
    : content.success.preparingManual;
  const status =
    entry.status === "ready"
      ? content.success.ready
      : entry.status === "problem"
        ? content.success.problem
        : preparing;
  // Only a finished provisioning has a server to open. A queued person still
  // gets their email note so they know where the update will arrive.
  const panel =
    entry.status === "ready"
      ? `<p class="actions"><a class="button" href="${escapeHtml(content.panelUrl)}" rel="noopener">${escapeHtml(content.success.panelAction)}</a></p>`
      : "";
  return `<section class="card success" aria-labelledby="success-heading">
    <h2 id="success-heading">${escapeHtml(content.success.heading)}</h2>
    ${existing}
    <p class="status" role="status">${escapeHtml(status)}</p>
    <p class="note">${escapeHtml(content.success.emailNote.replace("{email}", entry.email))}</p>
    ${panel}
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
                const icon =
                  runType === "vanilla"
                    ? "/icons/minecraft.svg"
                    : runType === "plugins"
                      ? "/icons/paper.svg"
                      : "/icons/curseforge.svg";
                const checked = selectedRun === runType ? " checked" : "";
                return `<label class="choice"><input type="radio" name="run_type" value="${runType}"${checked} required> <img class="choice-icon" src="${icon}" alt="" width="24" height="24" decoding="async"> <span>${escapeHtml(label)}</span></label>`;
              })
              .join("")}
          </fieldset>
          <div>
            <label for="run-detail">${escapeHtml(content.form.detailLabel)}</label>
            <input id="run-detail" name="run_detail" type="text" maxlength="120" value="${escapeHtml(view.values.runDetail)}">
          </div>
          ${turnstile}
          <div class="actions">
            <button class="button" type="submit" data-discord-submit disabled>${escapeHtml(content.form.discordButton)}</button>
          </div>
        </form>`;
}

// AUD-65: at capacity, the sign-up button is replaced by this block. It carries
// no count, no cap and no "limited slots" framing.
function capacityBlock(view: WishlistView, heading: string, inviteUrl: string | null): string {
  const discord = inviteUrl
    ? `<p class="actions"><a class="button button-secondary" href="${escapeHtml(inviteUrl)}" rel="noopener">${escapeHtml(content.capacity.discord)}</a></p>`
    : "";
  return `<section class="card signup-card waitlist-card" id="signup" aria-labelledby="form-heading">
        <h2 id="form-heading">${escapeHtml(content.capacity.heading)}</h2>
        <p role="status">${escapeHtml(content.capacity.body)}</p>
        ${fieldError(view.error)}
        ${discord}
      </section>`;
}

function waitlistCard(
  view: WishlistView,
  heading: string,
  inviteUrl: string | null,
): string {
  if (view.capacity === "full") return capacityBlock(view, heading, inviteUrl);
  let body: string;
  if (view.capacity === "closed") {
    body = fieldError(content.errors.closed);
  } else if (!view.discordEnabled || !view.siteKey) {
    body = `<p class="alert" role="alert">${escapeHtml(content.errors.unavailable)}</p>`;
  } else {
    body = waitlistForm(view);
  }
  return `<section class="card signup-card waitlist-card" id="signup" aria-labelledby="form-heading">
        <h2 id="form-heading">${escapeHtml(heading)}</h2>
        ${body}
      </section>`;
}

function stepsList(): string {
  return `<ol class="steps">${content.home.steps
    .map(
      (step, index) => `<li class="step">
        <span class="step-number" aria-hidden="true">${index + 1}</span>
        <h3>${escapeHtml(step.title)}</h3>
        <p>${escapeHtml(step.body)}</p>
      </li>`,
    )
    .join("")}</ol>`;
}

function sessionCards(): string {
  return `<div class="cards">${content.home.sessions
    .map(
      (item) => `<article class="card">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
      </article>`,
    )
    .join("")}</div>`;
}

export function homePage(view: WishlistView, inviteUrl: string | null): string {
  const community = inviteUrl
    ? `<p class="actions"><a class="button button-secondary" href="${escapeHtml(inviteUrl)}" rel="noopener">${escapeHtml(content.home.joinDiscord)}</a></p>`
    : "";
  const previewFaq = content.faq.slice(0, 5);

  return layout({
    title: titles.home,
    description: descriptions.home,
    path: "/",
    current: "home",
    inviteUrl,
    head: formHead(view),
    service: true,
    faq: previewFaq,
    main: `<div class="home">
      <div class="hero-band hero-band--photo">
        <img class="hero-band-photo" src="/art/world-valley.jpg" alt="" width="1280" height="720" decoding="async" fetchpriority="high" aria-hidden="true">
        <div class="hero-band-shade" aria-hidden="true"></div>
        <div class="frame">
          <section class="hero-split" aria-label="OpenGameNode free Minecraft hosting">
            <div class="hero-copy">
              ${heroCopy()}
              <div class="actions hero-actions">
                <a class="button" href="#signup">${escapeHtml(content.home.primaryAction)}</a>
                <a class="button button-secondary" href="/free-minecraft-server">${escapeHtml(content.home.specsLink)}</a>
              </div>
            </div>
            <div class="hero-side">
              ${view.success ? successBlock(view.success, view.autoProvision) : waitlistCard(view, content.home.signupHeading, inviteUrl)}
              <p class="note side-note">
                Prefer the panel? <a href="${content.panelUrl}" rel="noopener">${escapeHtml(content.nav.panel)}</a>
              </p>
            </div>
          </section>
        </div>
      </div>
      <div class="frame">
        <section class="stat-wrap" aria-label="Free server at a glance">
          ${statRow()}
          <p class="note stat-note">${escapeHtml(content.landing.region)} <a href="/free-minecraft-server">Full free Minecraft server specs</a>.</p>
        </section>

        <section class="section" id="how" aria-labelledby="steps-heading">
          <h2 id="steps-heading">${escapeHtml(content.home.stepsHeading)}</h2>
          <p class="section-intro">${escapeHtml(content.home.stepsIntro)}</p>
          ${stepsList()}
        </section>

        <section class="section" id="server-types" aria-labelledby="games-heading">
          <h2 id="games-heading">${escapeHtml(content.home.gamesHeading)}</h2>
          <p class="section-intro">${escapeHtml(content.home.gamesBody)}</p>
          ${serverTypeCards()}
        </section>

        <section class="section" aria-labelledby="modpack-heading">
          <div class="feature-split">
            <img src="/art/modpack-islands.jpg" alt="Floating islands, a crystal spire, and a wooden airship" width="1152" height="864" loading="lazy" decoding="async">
            <div>
              <h2 id="modpack-heading">${escapeHtml(content.home.modpackHeading)}</h2>
              <p>${escapeHtml(content.home.modpackBody)}</p>
              ${platformStrip()}
              <p class="note">${escapeHtml(content.home.modpackSoon)}</p>
              <p class="actions"><a class="button button-secondary" href="/signup">${escapeHtml(content.home.primaryAction)}</a></p>
            </div>
          </div>
        </section>

        <section class="section" aria-labelledby="features-heading">
          <h2 id="features-heading">${escapeHtml(content.home.featuresHeading)}</h2>
          <div class="cards">
            ${content.home.features
              .map(
                (feature) => `<article class="card feature-card">
              <h3>${escapeHtml(feature.title)}</h3>
              <p>${escapeHtml(feature.body)}</p>
            </article>`,
              )
              .join("")}
          </div>
        </section>

        <section class="section" id="sessions" aria-labelledby="sessions-heading">
          <h2 id="sessions-heading">${escapeHtml(content.home.sessionsHeading)}</h2>
          ${sessionCards()}
        </section>

        <section class="section" aria-labelledby="honest-heading">
          <div class="honest">
            <h2 id="honest-heading">${escapeHtml(content.home.honestHeading)}</h2>
            <p>${escapeHtml(content.home.honestBody)}</p>
            <p class="actions"><a class="button button-secondary" href="/free-minecraft-server">${escapeHtml(content.home.honestLink)}</a></p>
          </div>
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
          ${faqList(previewFaq)}
          <p class="actions"><a class="button button-secondary" href="/faq">${escapeHtml(content.home.faqMore)}</a></p>
        </section>

        <section class="section" aria-labelledby="community-heading">
          <div class="feature-split">
            <img src="/art/friends-camp.jpg" alt="Three blocky figures around a campfire above a forest valley" width="1280" height="720" loading="lazy" decoding="async">
            <div>
              <h2 id="community-heading">${escapeHtml(content.home.communityHeading)}</h2>
              <p class="section-intro">${escapeHtml(content.home.communityBody)}</p>
              ${community}
            </div>
          </div>
        </section>
      </div>
    </div>`,
  });
}

export function wishlistPage(view: WishlistView, inviteUrl: string | null): string {
  // /signup is the public URL. /wishlist remains because the Discord OAuth
  // callback already returns there; a bare /wishlist redirects to /signup.
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Sign up", path: "/signup" },
  ];
  const indexable = !view.success && !view.error;
  if (view.success) {
    return layout({
      title: `${content.success.heading} ${content.name}`,
      description: content.success.heading,
      path: "/signup",
      robots: "noindex, follow",
      current: "wishlist",
      inviteUrl,
      breadcrumbs: crumbs,
      main: `<div class="frame stack">${breadcrumbs(crumbs)}${successBlock(view.success, view.autoProvision)}</div>`,
    });
  }

  const previewFaq = content.faq.slice(0, 4);
  return layout({
    title: titles.signup,
    description: descriptions.signup,
    path: "/signup",
    robots: indexable ? undefined : "noindex, follow",
    current: "wishlist",
    inviteUrl,
    head: formHead(view),
    breadcrumbs: crumbs,
    faq: previewFaq,
    main: `<div class="frame stack signup-page">
      ${breadcrumbs(crumbs)}
      <section class="hero-split">
        <div class="hero-copy">
          <p class="eyebrow">${escapeHtml(content.name)}</p>
          <h1>Sign up for a free Minecraft server</h1>
          <p class="lede">${escapeHtml(content.landing.lede)}</p>
          ${statRow()}
          <p class="note">${escapeHtml(content.minecraftNote)} ${escapeHtml(content.landing.region)}</p>
        </div>
        <div class="hero-side">
          ${waitlistCard(view, content.form.heading, inviteUrl)}
        </div>
      </section>
      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">${escapeHtml(content.home.faqHeading)}</h2>
        ${faqList(previewFaq)}
        <p class="actions"><a class="button button-secondary" href="/faq">${escapeHtml(content.home.faqMore)}</a></p>
      </section>
    </div>`,
  });
}

export function minecraftPage(inviteUrl: string | null): string {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Free Minecraft server", path: "/free-minecraft-server" },
  ];
  const backups = SERVER_PLANS.vanilla.backups;
  const guideLinks = guides
    .filter((guide) => guide.slug !== "supporter-billing")
    .map(
      (guide) =>
        `<li><a href="/help/${guide.slug}">${escapeHtml(guide.title)}</a> — ${escapeHtml(guide.summary)}</li>`,
    )
    .join("");
  return layout({
    title: titles.minecraft,
    description: descriptions.minecraft,
    path: "/free-minecraft-server",
    current: "minecraft",
    inviteUrl,
    service: true,
    breadcrumbs: crumbs,
    faq: content.faq,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
      <section class="hero">
        <p class="eyebrow">${escapeHtml(content.name)}</p>
        <h1>${escapeHtml(content.headline)}</h1>
        <p class="lede">${escapeHtml(content.landing.lede)}</p>
        <p class="actions">
          <a class="button" href="/signup">${escapeHtml(content.home.primaryAction)}</a>
          <a class="button button-secondary" href="/faq">${escapeHtml(content.home.faqMore)}</a>
        </p>
      </section>
      <figure class="hero-photo">
        <img src="/art/world-valley.jpg" alt="A block-built castle above a river valley at night" width="1280" height="720" decoding="async">
      </figure>
      ${serverTypeCards()}
      ${platformStrip()}

      <section aria-labelledby="specs-heading">
        <h2 id="specs-heading">${escapeHtml(content.landing.specsHeading)}</h2>
        <p class="section-intro">${escapeHtml(content.landing.specsIntro)}</p>
        ${specTable()}
        <p class="note">Every plan includes ${backups} backup slot${backups === 1 ? "" : "s"} and ${SERVER_PLANS.vanilla.schedules} scheduled task${SERVER_PLANS.vanilla.schedules === 1 ? "" : "s"}. ${escapeHtml(content.landing.region)} Keep your own copy of the world too.</p>
      </section>

      <section aria-labelledby="shared-heading">
        <h2 id="shared-heading">${escapeHtml(content.landing.sharedHeading)}</h2>
        <ul class="facts">
          <li>On the free plan, about four hours each time you press Start. Supporter removes that cap.</li>
          <li>In the last ten minutes, extend twice a day for about four more hours each time.</li>
          <li>The server sleeps after five quiet minutes. Your world and files stay saved.</li>
          <li>Upload mods, plugins and worlds over SFTP.</li>
          <li>One small display ad per panel page. No ad before Start, and nothing in-game.</li>
          <li>A server only queues if 4 others are already starting or the node is full.</li>
        </ul>
      </section>

      <section aria-labelledby="limits-heading">
        <h2 id="limits-heading">${escapeHtml(content.landing.limitsHeading)}</h2>
        <ul class="facts">
          ${content.landing.limits.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </section>

      <section aria-labelledby="start-heading">
        <h2 id="start-heading">${escapeHtml(content.landing.startHeading)}</h2>
        <p class="section-intro">${escapeHtml(content.home.stepsIntro)}</p>
        ${stepsList()}
        <p class="actions"><a class="button" href="/signup">${escapeHtml(content.home.primaryAction)}</a></p>
      </section>

      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading">${escapeHtml(content.home.sessionsHeading)}</h2>
        ${sessionCards()}
      </section>

      <section aria-labelledby="guides-heading">
        <h2 id="guides-heading">Guides</h2>
        <ul class="guide-links">${guideLinks}</ul>
      </section>

      <section aria-labelledby="faq-heading">
        <h2 id="faq-heading">${escapeHtml(content.home.faqHeading)}</h2>
        ${faqList(content.faq)}
      </section>
    </div>`,
  });
}

export function faqPage(inviteUrl: string | null): string {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "FAQ", path: "/faq" },
  ];
  return layout({
    title: titles.faq,
    description: descriptions.faq,
    path: "/faq",
    current: "faq",
    inviteUrl,
    breadcrumbs: crumbs,
    faq: content.faq,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
      <section class="hero">
        <p class="eyebrow">${escapeHtml(content.name)}</p>
        <h1>Free Minecraft server FAQ</h1>
        <p class="supporting">Short answers about sessions, ads, plugins, Supporter and sign-up.</p>
      </section>
      ${faqList(content.faq)}
      <section class="card">
        <h2>Still stuck?</h2>
        <p>Ask in our Discord or email <a href="mailto:support@opengamenode.com">support@opengamenode.com</a>. The <a href="/free-minecraft-server">free Minecraft server page</a> lists the limits, and short how-tos live in the <a href="/help">help guides</a>.</p>
        <p class="actions"><a class="button" href="/signup">${escapeHtml(content.home.primaryAction)}</a></p>
      </section>
    </div>`,
  });
}

export function supporterPage(inviteUrl: string | null): string {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Supporter", path: "/supporter" },
  ];
  return layout({
    title: titles.supporter,
    description: descriptions.supporter,
    path: "/supporter",
    current: "supporter",
    inviteUrl,
    breadcrumbs: crumbs,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
      <section class="hero">
        <p class="eyebrow">${escapeHtml(content.supporter.tagline)}</p>
        <h1>${escapeHtml(content.supporter.heading)}</h1>
        <p class="supporting">${escapeHtml(content.supporter.lead)}</p>
      </section>
      <figure class="hero-photo">
        <img src="/art/modpack-islands.jpg" alt="Floating islands and a crystal spire, the kind of world a modpack is for" width="1152" height="864" decoding="async">
      </figure>
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
        <p>Every server is free. Supporter is optional and only removes ads and adds the extras above. The free plan keeps its own limits — Supporter doesn't unlock features that don't exist yet. See <a href="/free-minecraft-server">what the free Minecraft server includes</a>.</p>
        <p class="actions">
          <a class="button button-secondary" href="/">${escapeHtml(content.home.primaryAction)}</a>
          <a class="button button-secondary" href="/faq">Read the questions</a>
        </p>
      </section>
    </div>`,
  });
}

export function helpIndexPage(inviteUrl: string | null): string {
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Help", path: "/help" },
  ];
  return layout({
    title: titles.help,
    description: descriptions.help,
    path: "/help",
    current: "help",
    inviteUrl,
    breadcrumbs: crumbs,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
      <section class="hero">
        <p class="eyebrow">${escapeHtml(content.help.tagline)}</p>
        <h1>${escapeHtml(content.help.heading)}</h1>
        <p class="supporting">${escapeHtml(content.help.intro)}</p>
        <p>New here? Read <a href="/free-minecraft-server">what a free Minecraft server includes</a> first.</p>
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
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: "Help", path: "/help" },
    { name: guide.title, path: `/help/${guide.slug}` },
  ];
  return layout({
    title: `${guide.title} · ${content.name}`,
    description: guide.summary,
    path: `/help/${guide.slug}`,
    current: "help",
    inviteUrl,
    breadcrumbs: crumbs,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
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
  const crumbs: Crumb[] = [
    { name: "Home", path: "/" },
    { name: doc.title, path: doc.path },
  ];
  return layout({
    title: `${doc.title} · ${content.name}`,
    description: `${doc.title} for OpenGameNode, the free Minecraft server host.`,
    path: doc.path,
    current: "other",
    inviteUrl,
    breadcrumbs: crumbs,
    main: `<div class="frame stack">
      ${breadcrumbs(crumbs)}
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
    robots: "noindex",
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
    robots: "noindex",
    current: "other",
    inviteUrl,
    main: `<div class="frame hero">
      <h1>${escapeHtml(content.notFound.title)}</h1>
      <p class="supporting">${escapeHtml(content.notFound.body)}</p>
      <p><a class="button" href="/">${escapeHtml(content.notFound.home)}</a></p>
    </div>`,
  });
}
