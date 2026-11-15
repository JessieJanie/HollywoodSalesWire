/**
 * Public Greenlight lookup and the member Board export.
 * Lookup shows only stored public facts and their source URLs.
 */
import { Router, type Request, type Response } from "express";
import { desc } from "drizzle-orm";
import {
  db,
  checkoutEventsTable,
  productionsTable,
  spendReportDraftsTable,
  subscriberPreferencesTable,
  watchlistTable,
} from "@workspace/db";
import { SITE_URL } from "../lib/emailSequence";
import {
  boardCsv,
  crmImportCsv,
  likelyNeeds,
  productionsInLast12Months,
  searchProductions,
  spendReportMarkdown,
  type StoredProduction,
} from "../lib/greenlightBoard";
import { SHELF_COOKIE, verifyShelfSession, verifyShelfSig } from "./reports";

const router: Router = Router();

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function asStored(rows: unknown[]): StoredProduction[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || !("titleKey" in row)) return [];
    const production = row as unknown as {
      firstSeenAt: unknown;
      lastSeenAt: unknown;
      jurisdictions: unknown;
      sources: unknown;
    };
    const firstSeenAt = production.firstSeenAt instanceof Date ? production.firstSeenAt.toISOString() : String(production.firstSeenAt);
    const lastSeenAt = production.lastSeenAt instanceof Date ? production.lastSeenAt.toISOString() : String(production.lastSeenAt);
    return [{
      ...(row as object),
      firstSeenAt,
      lastSeenAt,
      jurisdictions: Array.isArray(production.jurisdictions) ? production.jurisdictions : [],
      sources: Array.isArray(production.sources) ? production.sources : [],
    } as StoredProduction];
  });
}

async function loadProductions(): Promise<StoredProduction[]> {
  const rows = await db.select().from(productionsTable).orderBy(desc(productionsTable.firstSeenAt));
  return asStored(rows);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title><link rel="canonical" href="${SITE_URL}/greenlight" /></head><body><main>${body}</main></body></html>`;
}

router.get("/greenlight", async (req: Request, res: Response) => {
  const query = typeof req.query.q === "string" ? req.query.q : "";
  const matches = searchProductions(await loadProductions(), query).slice(0, 25);
  const items = matches
    .map((production) => {
      const needs = likelyNeeds(production)
        .map((need) => `<li>likely needs ${escapeHtml(need.category)} — ${escapeHtml(need.reason)}</li>`)
        .join("");
      const sources = production.sources
        .map((source) => `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label || source.url)}</a> (${escapeHtml(source.status)})</li>`)
        .join("");
      return `<article><h2>${escapeHtml(production.title)}</h2><p>${escapeHtml(production.company)} · ${escapeHtml(production.jurisdictions.join(", "))} · ${escapeHtml(production.status)}</p><p>Credit: ${escapeHtml(production.credit ?? "not published")}. Qualified spend: ${escapeHtml(production.qualifiedSpend ?? "not published")}. Filming days: ${escapeHtml(production.filmingDays ?? "not published")}. Jobs: ${escapeHtml(production.jobs ?? "not published")}.</p><ul>${needs}</ul><ul>${sources}</ul></article>`;
    })
    .join("");
  res.type("html").send(
    page(
      "Greenlight lookup — Hollywood Sales Wire",
      `<h1>Greenlight lookup</h1><p>Search a title or company. Results are public records already on the board, with the source link for each. "Likely needs" is a category guess, not a fact that anyone has bought anything.</p><form method="get" action="/greenlight"><label>Title or company <input name="q" value="${escapeHtml(query)}" /></label><button type="submit">Search</button></form>${items || "<p>No matching public record.</p>"}<p><a href="/greenlight/methodology">How this page is built</a></p>`,
    ),
  );
});

router.get("/greenlight/methodology", (_req: Request, res: Response) => {
  res.type("html").send(
    page(
      "Greenlight methodology — Hollywood Sales Wire",
      `<h1>Methodology</h1>
<p>The board keeps one row per normalized title and company. The first date we stored is kept. Every source URL and the status we saw are kept. Dollar figures are copied from the public page and are not added together.</p>
<p>Vendor categories are labeled "likely needs". They are derived from the published project type, the credit or qualified-spend band, the published filming days, and the location. They are not purchase orders.</p>
<h2>Sources</h2>
<ul>
<li>California Film Commission approved-projects list: <a href="https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/">film.ca.gov</a>. Columns used: title, company, production type, California filming days, cast, crew, qualified expenditures, credit allocation.</li>
<li>New York ESD, Texas TMIIIP, New Mexico, Utah, and Georgia are requested when the publisher runs a refresh. A page that does not return a project table is recorded as no public project list or unreachable. Nothing is invented to fill the gap. On November 15, 2026, esd.ny.gov/industries/film-tax-credit returned 404, the Texas film office request from this network returned no response, nmfilm.com redirected, film.utah.gov returned a page without a parsed project table, and georgia.org returned HTTP 403 from a Cloudflare challenge.</li>
<li>NYC filming permits, dataset tg4x-b46p: <a href="https://data.cityofnewyork.us/resource/tg4x-b46p.json">SODA</a>. A refresh reads max(startdatetime). If that date is more than 60 days old, rows are stored and marked stale. On November 15, 2026 that maximum was 2026-08-15.</li>
<li>FilmLA quarterly shoot days and a studio hiring index are included in the monthly draft only when a cited figure is supplied. Otherwise the draft says they were not retrieved.</li>
</ul>
<p>The monthly State of Production Spend is a draft until a person marks it published. The public site does not promise that report before then.</p>`,
    ),
  );
});

function shelfEmail(req: Request): string | null {
  const raw = req.query.email;
  const sig = req.query.sig;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (email && typeof sig === "string" && verifyShelfSig(email, sig)) return email;
  return verifyShelfSession(req.cookies?.[SHELF_COOKIE]);
}

router.get("/api/board/export.csv", async (req: Request, res: Response) => {
  const email = shelfEmail(req);
  if (!email) {
    res.status(403).type("text").send("Shelf sign-in required");
    return;
  }
  const rows = productionsInLast12Months(await loadProductions(), new Date());
  res.type("text/csv").send(boardCsv(rows));
});

router.get("/api/board/crm.csv", async (req: Request, res: Response) => {
  if (!shelfEmail(req)) {
    res.status(403).type("text").send("Shelf sign-in required");
    return;
  }
  const rows = productionsInLast12Months(await loadProductions(), new Date());
  res.type("text/csv").send(crmImportCsv(rows));
});

router.post("/api/board/preferences", async (req: Request, res: Response) => {
  const signed = shelfEmail(req);
  if (!signed) {
    res.status(403).json({ error: "Shelf sign-in required" });
    return;
  }
  const body = req.body ?? {};
  const lists = {
    states: asStringList(body.states),
    projectTypes: asStringList(body.projectTypes),
    budgetBands: asStringList(body.budgetBands),
    vendorCategories: asStringList(body.vendorCategories),
  };
  await db
    .insert(subscriberPreferencesTable)
    .values({ email: signed, ...lists, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: subscriberPreferencesTable.email,
      set: { ...lists, updatedAt: new Date() },
    });
  res.json({ ok: true });
});

router.post("/api/board/watch", async (req: Request, res: Response) => {
  const email = shelfEmail(req);
  if (!email) {
    res.status(403).json({ error: "Shelf sign-in required" });
    return;
  }
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
  const titleKey = typeof req.body?.titleKey === "string" ? req.body.titleKey.trim().toLowerCase() : null;
  const companyKey = typeof req.body?.companyKey === "string" ? req.body.companyKey.trim().toLowerCase() : null;
  if (!label || (!titleKey && !companyKey)) {
    res.status(400).json({ error: "Name a production or a company to follow." });
    return;
  }
  await db.insert(watchlistTable).values({ email, label, titleKey, companyKey }).onConflictDoNothing();
  res.json({ ok: true });
});

router.post("/api/board/spend-draft", async (req: Request, res: Response) => {
  const monthKey = typeof req.body?.monthKey === "string" ? req.body.monthKey : "";
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: "monthKey must be YYYY-MM" });
    return;
  }
  const markdown = spendReportMarkdown({
    monthKey,
    productions: await loadProductions(),
    filmLaShootDays: null,
    studioHiringIndex: null,
  });
  const [row] = await db.insert(spendReportDraftsTable).values({ monthKey, markdown, status: "draft" }).returning({ id: spendReportDraftsTable.id });
  res.json({ id: row?.id, status: "draft" });
});

router.post("/api/checkout-events", async (req: Request, res: Response) => {
  const kind = req.body?.kind;
  if (kind !== "offer_view" && kind !== "plan_click") {
    res.status(400).json({ error: "unsupported checkout event" });
    return;
  }
  await db.insert(checkoutEventsTable).values({
    kind,
    path: typeof req.body?.path === "string" ? req.body.path.slice(0, 200) : null,
    plan: typeof req.body?.plan === "string" ? req.body.plan.slice(0, 80) : null,
    deadlineParam: typeof req.body?.deadline === "string" ? req.body.deadline.slice(0, 32) : null,
  });
  res.status(204).end();
});

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default router;
