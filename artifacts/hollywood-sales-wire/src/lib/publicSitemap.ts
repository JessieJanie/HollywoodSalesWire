import { ARTICLES } from "./articles.ts";
import { PRESS_RELEASES } from "./pressReleases.ts";
import { PUBLIC_COPY_REVISED } from "./sourcedClaims.ts";

const SITE = "https://hollywoodsaleswire.com";

export interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq: "weekly" | "monthly" | "yearly";
  priority: string;
}

function latest(dates: string[]): string | undefined {
  return dates.slice().sort().at(-1);
}

/**
 * lastmod comes from a date the page actually carries: article and press
 * `datePublished`, or PUBLIC_COPY_REVISED for the home and order pages whose
 * claims were corrected on that day. Pages with no such date omit lastmod.
 */
export function publicSitemapEntries(): SitemapEntry[] {
  const newestArticle = latest(ARTICLES.map((article) => article.datePublished));
  const newestPress = latest(PRESS_RELEASES.map((release) => release.datePublished));
  return [
    { path: "/", lastmod: PUBLIC_COPY_REVISED, changefreq: "weekly", priority: "1.0" },
    { path: "/order", lastmod: PUBLIC_COPY_REVISED, changefreq: "monthly", priority: "0.8" },
    { path: "/faq", changefreq: "monthly", priority: "0.7" },
    { path: "/press", lastmod: newestPress, changefreq: "monthly", priority: "0.7" },
    ...PRESS_RELEASES.map((release) => ({
      path: `/press/${release.slug}`,
      lastmod: release.datePublished,
      changefreq: "yearly" as const,
      priority: "0.6",
    })),
    { path: "/articles", lastmod: newestArticle, changefreq: "weekly", priority: "0.7" },
    ...ARTICLES.map((article) => ({
      path: `/articles/${article.slug}`,
      lastmod: article.datePublished,
      changefreq: "yearly" as const,
      priority: "0.6",
    })),
  ];
}

export function renderPublicSitemap(entries = publicSitemapEntries()): string {
  const urls = entries
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${SITE}${entry.path}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
