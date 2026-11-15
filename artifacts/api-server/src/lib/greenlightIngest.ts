import { and, eq } from "drizzle-orm";
import { db, productionsTable, watchEventsTable, watchlistTable } from "@workspace/db";
import {
  CA_APPROVED_URL,
  NYC_PERMITS_URL,
  mergeProduction,
  normalizeKey,
  nycFreshness,
  parseCaCells,
  parseNycPermit,
  watchHits,
  type ProductionInput,
} from "./greenlightBoard";

export interface SourceAttempt {
  id: string;
  url: string;
  status: "ok" | "stale" | "unreachable" | "no_public_project_list";
  detail: string;
}

export interface FetchedSource {
  id: string;
  url: string;
  ok: boolean;
  statusCode: number;
  body: string;
}

export const OTHER_BOARD_SOURCES = [
  { id: "ny-esd", url: "https://esd.ny.gov/industries/film-tax-credit" },
  { id: "tx-tmiiip", url: "https://gov.texas.gov/film/page/texas-moving-image-industry-incentive-program" },
  { id: "nm-film", url: "https://nmfilm.com/productions" },
  { id: "ut-film", url: "https://film.utah.gov/" },
  { id: "ga-film", url: "https://www.georgia.org/industries/film-entertainment/georgia-film-tv-production" },
] as const;

function cellsFromHtmlRow(row: string): string[] {
  return [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(),
  );
}

export function parseCaApprovedHtml(html: string, fetchedAt: string): ProductionInput[] {
  const source = { url: CA_APPROVED_URL, label: "California Film Commission approved projects", status: "ok", fetchedAt };
  return [...html.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((row) => parseCaCells(cellsFromHtmlRow(row[0]), source))
    .filter((row): row is ProductionInput => row !== null);
}

/** Turn fetched pages into productions and an honest attempt log. No row is invented for a failed fetch. */
export function ingestFetchedSources(pages: FetchedSource[], now: Date): { productions: ProductionInput[]; attempts: SourceAttempt[] } {
  const productions: ProductionInput[] = [];
  const attempts: SourceAttempt[] = [];
  const fetchedAt = now.toISOString();
  for (const page of pages) {
    if (!page.ok) {
      attempts.push({
        id: page.id,
        url: page.url,
        status: "unreachable",
        detail: `HTTP ${page.statusCode || "no response"}`,
      });
      continue;
    }
    if (page.id === "ca-film-commission") {
      const rows = parseCaApprovedHtml(page.body, fetchedAt);
      attempts.push({
        id: page.id,
        url: page.url,
        status: rows.length ? "ok" : "no_public_project_list",
        detail: rows.length ? `${rows.length} approved-project rows parsed` : "Page returned no HTML table rows.",
      });
      productions.push(...rows);
      continue;
    }
    if (page.id === "nyc-permits") {
      let parsed: unknown = [];
      try {
        parsed = JSON.parse(page.body);
      } catch {
        attempts.push({ id: page.id, url: page.url, status: "unreachable", detail: "Response was not JSON." });
        continue;
      }
      const records = Array.isArray(parsed) ? parsed : [];
      const dates = records
        .map((row) => (row && typeof row === "object" ? (row as { startdatetime?: string }).startdatetime : undefined))
        .filter((value): value is string => typeof value === "string");
      const newest = dates.sort().at(-1) ?? null;
      const freshness = nycFreshness(newest, now);
      const source = {
        url: NYC_PERMITS_URL,
        label: "NYC Open Data film permits tg4x-b46p",
        status: freshness.stale ? "stale" : "ok",
        fetchedAt,
      };
      const rows = records
        .map((row) => parseNycPermit(row as { eventtype?: string; category?: string; subcategoryname?: string; eventid?: string }, source, freshness))
        .filter((row): row is ProductionInput => row !== null);
      attempts.push({
        id: page.id,
        url: page.url,
        status: freshness.stale ? "stale" : "ok",
        detail: freshness.detail,
      });
      productions.push(...rows);
      continue;
    }
    attempts.push({
      id: page.id,
      url: page.url,
      status: "no_public_project_list",
      detail: "The page responded, and this refresh does not treat it as a project table. No productions were added from it.",
    });
  }
  for (const source of OTHER_BOARD_SOURCES) {
    if (!attempts.some((attempt) => attempt.id === source.id)) {
      attempts.push({ id: source.id, url: source.url, status: "unreachable", detail: "Not fetched." });
    }
  }
  return { productions, attempts };
}

export async function refreshGreenlightBoard(fetchImpl: typeof fetch = fetch, now = new Date()): Promise<SourceAttempt[]> {
  const targets = [
    { id: "ca-film-commission", url: CA_APPROVED_URL },
    { id: "nyc-permits", url: `${NYC_PERMITS_URL}?$limit=200&$order=startdatetime%20DESC` },
    ...OTHER_BOARD_SOURCES,
  ];
  const pages: FetchedSource[] = [];
  for (const target of targets) {
    try {
      const response = await fetchImpl(target.url, { signal: AbortSignal.timeout(20_000) });
      pages.push({ ...target, ok: response.ok, statusCode: response.status, body: await response.text() });
    } catch {
      pages.push({ ...target, ok: false, statusCode: 0, body: "" });
    }
  }
  const { productions } = ingestFetchedSources(pages, now);
  const seenAt = now.toISOString();
  for (const incoming of productions) {
    const titleKey = normalizeKey(incoming.title);
    const companyKey = normalizeKey(incoming.company);
    const [existing] = await db
      .select()
      .from(productionsTable)
      .where(and(eq(productionsTable.titleKey, titleKey), eq(productionsTable.companyKey, companyKey)))
      .limit(1);
    const merged = mergeProduction(
      existing
        ? {
            ...existing,
            jurisdictions: Array.isArray(existing.jurisdictions) ? (existing.jurisdictions as string[]) : [],
            sources: Array.isArray(existing.sources) ? (existing.sources as StoredSource[]) : [],
            firstSeenAt: existing.firstSeenAt.toISOString(),
            lastSeenAt: existing.lastSeenAt.toISOString(),
          }
        : undefined,
      incoming,
      seenAt,
    );
    await db
      .insert(productionsTable)
      .values({
        ...merged,
        firstSeenAt: new Date(merged.firstSeenAt),
        lastSeenAt: new Date(merged.lastSeenAt),
      })
      .onConflictDoUpdate({
        target: [productionsTable.titleKey, productionsTable.companyKey],
        set: {
          jurisdictions: merged.jurisdictions,
          projectType: merged.projectType,
          credit: merged.credit,
          qualifiedSpend: merged.qualifiedSpend,
          filmingDays: merged.filmingDays,
          jobs: merged.jobs,
          status: merged.status,
          lastSeenAt: new Date(merged.lastSeenAt),
          sources: merged.sources,
        },
      });
    const previousUrls = new Set((existing && Array.isArray(existing.sources) ? existing.sources : []).map((source) => (source as { url?: string }).url));
    const added = merged.sources.some((source) => !previousUrls.has(source.url));
    if (!existing || added) {
      const watches = await db.select().from(watchlistTable);
      const kind = incoming.jurisdiction === "NYC" ? "permit" : "registry";
      const hits = watchHits(
        watches.map((watch) => ({ id: watch.id, titleKey: watch.titleKey, companyKey: watch.companyKey })),
        merged,
        kind,
      );
      for (const hit of hits) {
        await db.insert(watchEventsTable).values(hit);
      }
    }
  }
  return ingestFetchedSources(pages, now).attempts;
}

type StoredSource = { url: string; label: string; status: string; fetchedAt: string };
