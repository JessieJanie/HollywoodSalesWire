/**
 * Public web archive of sent HSW Weekly Briefs (the free email).
 *
 * Served by the api-server as plain, fully-rendered HTML (no JavaScript
 * needed) so search engines and AI crawlers can read every word. The Brief is
 * already free to anyone who signs up, so archiving it publicly gives the site
 * fresh weekly content without exposing anything members pay for.
 *
 * Routes (mounted at /briefs, outside the /api prefix):
 *   GET /briefs               — index of all sent Briefs, newest first
 *   GET /briefs/sitemap.xml   — sitemap for this section (linked from robots.txt)
 *   GET /briefs/:date         — one Brief (date = YYYY-MM-DD of its send)
 */
import { Router, type Request, type Response } from "express";
import { and, desc, gte, lt } from "drizzle-orm";
import { db, weeklyPreviewsTable, type WeeklyPreview } from "@workspace/db";
import { SITE_URL } from "../lib/emailSequence";

const router: Router = Router();

const CACHE_HEADER = "public, max-age=300";

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function dateSlug(sentAt: Date): string {
  return sentAt.toISOString().slice(0, 10);
}

function humanDate(sentAt: Date): string {
  return sentAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

const ORDER_URL = `${SITE_URL}/order?utm_source=brief-archive&utm_medium=web&utm_campaign=brief-archive`;

/** Brief body text → HTML. "→ " lines become a link-button to the order page. */
function bodyHtml(bodyText: string): string {
  return bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      /^→\s*/.test(s)
        ? `<p class="cta"><a href="${ORDER_URL}">${escapeHtml(s.replace(/^→\s*/, ""))} &rarr;</a></p>`
        : `<p>${escapeHtml(s).replace(/\n/g, "<br />")}</p>`,
    )
    .join("\n");
}

/** Shared page shell that echoes the site's look (cream, serif, deep green). */
function page(opts: {
  title: string;
  description: string;
  canonicalPath: string;
  bodyHtml: string;
  jsonLd?: object;
}): string {
  const title = escapeHtml(opts.title);
  const desc = escapeHtml(opts.description);
  const canonical = `${SITE_URL}${opts.canonicalPath}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${desc}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${canonical}" />
<meta property="og:site_name" content="Hollywood Sales Wire" />
<link rel="icon" type="image/svg+xml" href="${SITE_URL}/favicon.svg" />
${opts.jsonLd ? `<script type="application/ld+json">${JSON.stringify(opts.jsonLd).replaceAll("<", "\\u003c")}</script>` : ""}
<style>
  body{margin:0;background:#f6f5f2;color:#1a1a1a;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.7;}
  .wrap{max-width:640px;margin:0 auto;padding:32px 20px 64px;}
  .card{background:#fff;border:1px solid #e5e2da;padding:36px 32px;}
  .kicker{font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;margin:0 0 8px;}
  h1{font-size:28px;line-height:1.25;margin:0 0 6px;}
  .date{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#8a8577;margin:0 0 24px;}
  a{color:#1d5c3a;}
  .cta a{display:inline-block;background:#1d5c3a;color:#fff;padding:12px 24px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;}
  .site{font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:0 0 20px;}
  .site a{color:#8a8577;text-decoration:none;}
  hr{border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;}
  .about{font-size:14px;color:#5a564c;}
  ul.index{list-style:none;padding:0;margin:0;}
  ul.index li{margin:0 0 18px;}
  ul.index .when{display:block;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#8a8577;}
</style>
</head>
<body>
<div class="wrap">
  <p class="site"><a href="${SITE_URL}/">&larr; hollywoodsaleswire.com</a></p>
  <div class="card">
${opts.bodyHtml}
  <hr />
  <p class="about"><strong>What is Hollywood Sales Wire?</strong><br />
  Hollywood Sales Wire is a weekly sales-intelligence briefing for the vendors, service providers, and dealmakers who sell to the entertainment industry. Each issue turns public signals — production spending, brand-new production entities on government registries, and studio hiring — into specific opportunities, with the names and contact paths included.<br />
  Publisher: Karilyn Colegrove &middot; <a href="${SITE_URL}/">hollywoodsaleswire.com</a></p>
  <p class="cta"><a href="${ORDER_URL}">Become a Member &rarr;</a></p>
  </div>
</div>
</body>
</html>`;
}

async function allSent(): Promise<WeeklyPreview[]> {
  return db
    .select()
    .from(weeklyPreviewsTable)
    .orderBy(desc(weeklyPreviewsTable.sentAt));
}

router.get("/", async (_req: Request, res: Response) => {
  const rows = await allSent();
  const items = rows
    .map(
      (r) =>
        `<li><span class="when">${escapeHtml(humanDate(r.sentAt))}</span><a href="${SITE_URL}/briefs/${dateSlug(r.sentAt)}">${escapeHtml(r.subject)}</a></li>`,
    )
    .join("\n");
  const body = `
  <p class="kicker">HSW Weekly Brief — Archive</p>
  <h1>The Weekly Brief archive</h1>
  <p>The HSW Weekly Brief is the free edition of Hollywood Sales Wire — a short weekly read on where entertainment-industry money is moving, drawn from public filings, state tax-credit award lists, government registries, and studio hiring signals. Every issue we've sent is archived here.</p>
  ${rows.length ? `<ul class="index">${items}</ul>` : `<p><em>The first Weekly Brief lands soon — <a href="${SITE_URL}/">sign up on the home page</a> to get it by email.</em></p>`}`;
  res
    .status(200)
    .set("Cache-Control", CACHE_HEADER)
    .type("html")
    .send(
      page({
        title: "Weekly Brief Archive — Hollywood Sales Wire",
        description:
          "Every issue of the free HSW Weekly Brief: weekly signals on entertainment-industry production spending, new production companies, and studio hiring.",
        canonicalPath: "/briefs",
        bodyHtml: body,
      }),
    );
});

router.get("/sitemap.xml", async (_req: Request, res: Response) => {
  const rows = await allSent();
  const urls = [
    `<url><loc>${SITE_URL}/briefs</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...rows.map(
      (r) =>
        `<url><loc>${SITE_URL}/briefs/${dateSlug(r.sentAt)}</loc><lastmod>${dateSlug(r.sentAt)}</lastmod><changefreq>yearly</changefreq><priority>0.6</priority></url>`,
    ),
  ].join("\n");
  res
    .status(200)
    .set("Cache-Control", CACHE_HEADER)
    .type("application/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
});

router.get("/:date", async (req: Request, res: Response) => {
  const dateParam = typeof req.params.date === "string" ? req.params.date : "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!m) {
    res.status(404).type("html").send(notFound());
    return;
  }
  const dayStart = new Date(`${m[0]}T00:00:00Z`);
  // Reject impossible calendar dates (e.g. 2026-02-31, which Date would
  // silently normalize to a different day and serve the wrong issue).
  if (
    Number.isNaN(dayStart.getTime()) ||
    dayStart.toISOString().slice(0, 10) !== dateParam
  ) {
    res.status(404).type("html").send(notFound());
    return;
  }
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const rows = await db
    .select()
    .from(weeklyPreviewsTable)
    .where(and(gte(weeklyPreviewsTable.sentAt, dayStart), lt(weeklyPreviewsTable.sentAt, dayEnd)))
    .orderBy(desc(weeklyPreviewsTable.sentAt))
    .limit(1);
  const row = rows[0];
  if (!row) {
    res.status(404).type("html").send(notFound());
    return;
  }
  const slug = dateSlug(row.sentAt);
  const description = row.bodyText.replace(/\s+/g, " ").trim().slice(0, 155);
  const body = `
  <p class="kicker">HSW Weekly Brief</p>
  <h1>${escapeHtml(row.subject)}</h1>
  <p class="date">${escapeHtml(humanDate(row.sentAt))} &middot; <a href="${SITE_URL}/briefs">All issues</a></p>
  ${bodyHtml(row.bodyText)}`;
  res
    .status(200)
    .set("Cache-Control", CACHE_HEADER)
    .type("html")
    .send(
      page({
        title: `${row.subject} — HSW Weekly Brief`,
        description,
        canonicalPath: `/briefs/${slug}`,
        bodyHtml: body,
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "Article",
          headline: row.subject,
          datePublished: row.sentAt.toISOString(),
          author: { "@type": "Person", name: "Karilyn Colegrove" },
          publisher: { "@type": "Organization", name: "Hollywood Sales Wire", url: `${SITE_URL}/` },
          mainEntityOfPage: `${SITE_URL}/briefs/${slug}`,
        },
      }),
    );
});

function notFound(): string {
  return page({
    title: "Issue not found — Hollywood Sales Wire",
    description: "That Weekly Brief issue was not found.",
    canonicalPath: "/briefs",
    bodyHtml: `<p class="kicker">HSW Weekly Brief</p><h1>Issue not found</h1><p>That issue isn't in the archive. <a href="${SITE_URL}/briefs">See all issues</a>.</p>`,
  });
}

export default router;
