// Search metadata for the public site. Titles, descriptions, JSON-LD, the
// sitemap and robots.txt all live here so a new public page is one entry,
// not a scavenger hunt. Numbers that match a server plan are read from
// plans.ts so the specs Google sees cannot drift from what we provision.

import { content } from "./content";
import { guides } from "./guides";
import { SERVER_PLANS } from "./plans";

// Bump when public copy or routes change so crawlers see a real lastmod.
const CONTENT_UPDATED = "2026-11-13";

const RAM = Math.round(SERVER_PLANS.vanilla.memoryMiB / 1024);
const MOD_RAM = Math.round(SERVER_PLANS.modpack.memoryMiB / 1024);
const DISK = Math.round(SERVER_PLANS.vanilla.diskMiB / 1024);

export const titles = {
  home: `${content.name} — Free Minecraft Server Hosting`,
  signup: `Sign Up for a Free Minecraft Server · ${content.name}`,
  faq: `Free Minecraft Server FAQ · ${content.name}`,
  minecraft: `Free Minecraft Server Hosting · ${content.name}`,
  supporter: `${content.supporter.heading} · ${content.name}`,
  help: `Minecraft Server Help · ${content.name}`,
} as const;

export const descriptions = {
  home: `OpenGameNode hosts free Minecraft Java servers. Sign up with Discord for ${RAM} GB RAM, or ${MOD_RAM} GB for a modpack. No ad before you press Start.`,
  signup: "Sign up with Discord for a free OpenGameNode Minecraft server. Pick vanilla, Paper plugins, or a modpack. No password to set up.",
  faq: "How OpenGameNode free Minecraft servers work: sessions, ads, plugins, modpacks, Supporter, and who can sign up.",
  minecraft: `Free Minecraft Java hosting from OpenGameNode: ${RAM} GB RAM for vanilla and Paper, ${MOD_RAM} GB for a modpack, ${DISK} GB disk, about four hours a session.`,
  supporter: "OpenGameNode Supporter is $1.99/month: no ads, priority start, +1 GB RAM and a Discord role. Cancel anytime.",
  help: "Short guides for starting a free Minecraft server, inviting friends, uploading a world, keeping backups and Supporter billing.",
} as const;

type Crumb = { name: string; path: string };
type FaqItem = { question: string; answer: string };

function absolute(path: string): string {
  return `${content.siteOrigin}${path === "/" ? "" : path}`;
}

export function pageStructuredData(input: {
  title: string;
  description: string;
  path: string;
  inviteUrl: string | null;
  breadcrumbs?: readonly Crumb[];
  faq?: readonly FaqItem[];
  service?: boolean;
}): unknown {
  const origin = content.siteOrigin;
  const pageUrl = absolute(input.path);
  const graph: unknown[] = [
    {
      "@type": "Organization",
      "@id": `${origin}/#organization`,
      name: content.name,
      alternateName: ["Open Game Node", "OGN", "opengamnode"],
      url: absolute("/"),
      logo: `${origin}/brand/opengamenode-icon.png`,
      email: "support@opengamenode.com",
      ...(input.inviteUrl ? { sameAs: [input.inviteUrl] } : {}),
    },
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      name: content.name,
      alternateName: ["Open Game Node", "OGN", "opengamnode"],
      url: absolute("/"),
      description: descriptions.home,
      publisher: { "@id": `${origin}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": "WebPage",
      "@id": `${pageUrl}#webpage`,
      url: pageUrl,
      name: input.title,
      description: input.description,
      dateModified: CONTENT_UPDATED,
      isPartOf: { "@id": `${origin}/#website` },
      about: { "@id": `${origin}/#organization` },
      inLanguage: "en",
    },
  ];

  if (input.service) {
    graph.push({
      "@type": "Service",
      "@id": `${origin}/#service`,
      name: "Free Minecraft server hosting",
      serviceType: "Minecraft server hosting",
      provider: { "@id": `${origin}/#organization` },
      url: `${origin}/free-minecraft-server`,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        description: "Free Minecraft Java server. Supporter is an optional $1.99 per month.",
      },
    });
  }

  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: input.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.name,
        item: absolute(crumb.path),
      })),
    });
  }

  if (input.faq && input.faq.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: input.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function jsonLdScript(data: unknown): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

type SitemapEntry = { path: string; priority: string };

function publicPaths(): SitemapEntry[] {
  return [
    { path: "/", priority: "1.0" },
    { path: "/free-minecraft-server", priority: "0.9" },
    { path: "/signup", priority: "0.8" },
    { path: "/faq", priority: "0.7" },
    { path: "/help", priority: "0.6" },
    ...guides.map((guide) => ({ path: `/help/${guide.slug}`, priority: "0.5" })),
    { path: "/supporter", priority: "0.4" },
    { path: "/terms", priority: "0.2" },
    { path: "/privacy", priority: "0.2" },
    { path: "/aup", priority: "0.2" },
  ];
}

export function sitemapXml(): string {
  const urls = publicPaths()
    .map(
      (entry) =>
        `  <url><loc>${absolute(entry.path)}</loc><lastmod>${CONTENT_UPDATED}</lastmod><priority>${entry.priority}</priority></url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api/",
    "",
    `Sitemap: ${content.siteOrigin}/sitemap.xml`,
    "",
  ].join("\n");
}
