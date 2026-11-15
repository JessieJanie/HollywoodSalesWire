/**
 * Greenlight Board rules. Figures stay as published strings. Vendor tags are
 * labeled "likely needs" and are derived, never stated as a purchase.
 */

export const NYC_PERMITS_URL = "https://data.cityofnewyork.us/resource/tg4x-b46p.json";
export const CA_APPROVED_URL = "https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/";

/** A permit dataset whose newest activity is older than this is not "current". */
export const NYC_FRESHNESS_DAYS = 60;

export interface BoardSource {
  url: string;
  label: string;
  status: string;
  fetchedAt: string;
}

export interface ProductionInput {
  title: string;
  company: string;
  jurisdiction: string;
  projectType: string | null;
  credit: string | null;
  qualifiedSpend: string | null;
  filmingDays: string | null;
  jobs: string | null;
  status: string;
  source: BoardSource;
}

export interface StoredProduction {
  title: string;
  company: string;
  titleKey: string;
  companyKey: string;
  jurisdictions: string[];
  projectType: string | null;
  credit: string | null;
  qualifiedSpend: string | null;
  filmingDays: string | null;
  jobs: string | null;
  status: string;
  firstSeenAt: string;
  lastSeenAt: string;
  sources: BoardSource[];
}

export interface LikelyNeed {
  label: "likely needs";
  category: string;
  reason: string;
}

export function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function mergeProduction(
  existing: StoredProduction | undefined,
  incoming: ProductionInput,
  seenAt: string,
): StoredProduction {
  const titleKey = normalizeKey(incoming.title);
  const companyKey = normalizeKey(incoming.company);
  if (!existing) {
    return {
      title: incoming.title,
      company: incoming.company,
      titleKey,
      companyKey,
      jurisdictions: [incoming.jurisdiction],
      projectType: incoming.projectType,
      credit: incoming.credit,
      qualifiedSpend: incoming.qualifiedSpend,
      filmingDays: incoming.filmingDays,
      jobs: incoming.jobs,
      status: incoming.status,
      firstSeenAt: seenAt,
      lastSeenAt: seenAt,
      sources: [incoming.source],
    };
  }
  const jurisdictions = existing.jurisdictions.includes(incoming.jurisdiction)
    ? existing.jurisdictions
    : [...existing.jurisdictions, incoming.jurisdiction];
  const sources = existing.sources.some((source) => source.url === incoming.source.url && source.status === incoming.source.status)
    ? existing.sources
    : [...existing.sources, incoming.source];
  return {
    ...existing,
    jurisdictions,
    projectType: incoming.projectType ?? existing.projectType,
    credit: incoming.credit ?? existing.credit,
    qualifiedSpend: incoming.qualifiedSpend ?? existing.qualifiedSpend,
    filmingDays: incoming.filmingDays ?? existing.filmingDays,
    jobs: incoming.jobs ?? existing.jobs,
    status: incoming.status,
    firstSeenAt: existing.firstSeenAt,
    lastSeenAt: seenAt,
    sources,
  };
}

export function dollars(value: string | null): number | null {
  if (!value) return null;
  const match = value.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]);
}

export function budgetBand(production: Pick<StoredProduction, "credit" | "qualifiedSpend">): string | null {
  const amount = dollars(production.qualifiedSpend) ?? dollars(production.credit);
  if (amount === null) return null;
  if (amount < 1_000_000) return "under $1 million";
  if (amount < 10_000_000) return "$1–10 million";
  if (amount < 40_000_000) return "$10–40 million";
  return "$40 million and up";
}

export function likelyNeeds(production: StoredProduction): LikelyNeed[] {
  const needs: LikelyNeed[] = [];
  const type = (production.projectType ?? "").toLowerCase();
  const days = production.filmingDays?.trim() ?? "";
  const dayCount = /^\d+$/.test(days) ? Number(days) : null;
  const band = budgetBand(production);
  const animated = type.includes("animat");
  const live = type.includes("live") || type.includes("feature") || type.includes("television") || type.includes("series");
  if (animated || dayCount === 0 || days === "-" || days === "") {
    if (animated) {
      needs.push({
        label: "likely needs",
        category: "animation and post",
        reason: `Project type is "${production.projectType ?? "unspecified"}", so location services are not assumed.`,
      });
    }
  }
  if (live && dayCount !== null && dayCount > 0) {
    needs.push({
      label: "likely needs",
      category: "locations, local crew, equipment rental, transportation, catering",
      reason: `${dayCount} in-state filming days are published for this ${production.projectType}. That is a location shoot, not proof of a purchase order.`,
    });
  }
  if (band && (band === "$10–40 million" || band === "$40 million and up") && !animated) {
    needs.push({
      label: "likely needs",
      category: "payroll and camera package",
      reason: `Published qualified spend or credit falls in ${band}. The band is a size clue, not a vendor award.`,
    });
  }
  if (production.jurisdictions.includes("NYC") && type.includes("shoot")) {
    needs.push({
      label: "likely needs",
      category: "NYC location services and extras",
      reason: "A New York City filming permit lists a shooting activity. A permit is not a budget.",
    });
  }
  return needs;
}

export function nycFreshness(newestIso: string | null, now: Date): { stale: boolean; detail: string } {
  if (!newestIso || Number.isNaN(Date.parse(newestIso))) {
    return { stale: true, detail: "NYC Open Data returned no usable start date, so permits are not treated as current." };
  }
  const ageDays = (now.getTime() - Date.parse(newestIso)) / 86_400_000;
  if (ageDays > NYC_FRESHNESS_DAYS) {
    return {
      stale: true,
      detail: `Newest NYC permit activity is ${newestIso.slice(0, 10)}, which is more than ${NYC_FRESHNESS_DAYS} days before ${now.toISOString().slice(0, 10)}. Rows are kept and marked stale, not described as current.`,
    };
  }
  return { stale: false, detail: `Newest NYC permit activity is ${newestIso.slice(0, 10)}.` };
}

export function parseCaCells(cells: string[], source: BoardSource): ProductionInput | null {
  if (cells.length < 11) return null;
  const [year, title, company, projectType, , filmingDays, cast, crew, , qualified, credit] = cells;
  if (!title?.trim() || !company?.trim() || title.toLowerCase().includes("production title")) return null;
  const jobs = [cast, crew].every((value) => value && value !== "-")
    ? `cast ${cast}, crew ${crew}`
    : null;
  return {
    title: title.replace(/\*$/, "").trim(),
    company: company.trim(),
    jurisdiction: "CA",
    projectType: projectType?.trim() || null,
    credit: credit?.trim() || null,
    qualifiedSpend: qualified?.trim() || null,
    filmingDays: filmingDays?.trim() || null,
    jobs,
    status: `approved ${year?.trim() ?? ""}`.trim(),
    source,
  };
}

export interface NycPermitRow {
  eventid?: string;
  eventtype?: string;
  startdatetime?: string;
  category?: string;
  subcategoryname?: string;
  borough?: string;
}

export function parseNycPermit(
  row: NycPermitRow,
  source: BoardSource,
  freshness: { stale: boolean; detail: string },
): ProductionInput | null {
  const title = row.subcategoryname?.trim() || row.category?.trim();
  if (!title) return null;
  return {
    title,
    company: row.category?.trim() || "NYC permit applicant",
    jurisdiction: "NYC",
    projectType: row.eventtype?.trim() || null,
    credit: null,
    qualifiedSpend: null,
    filmingDays: null,
    jobs: null,
    status: freshness.stale ? `permit ${row.eventid ?? ""}; dataset stale`.trim() : `permit ${row.eventid ?? ""}`.trim(),
    source: { ...source, status: freshness.stale ? `stale: ${freshness.detail}` : source.status },
  };
}

export interface SubscriberPreferences {
  states: string[];
  projectTypes: string[];
  budgetBands: string[];
  vendorCategories: string[];
}

export function yourTerritory(prefs: SubscriberPreferences, productions: StoredProduction[]): string {
  const matched = productions.filter((production) => {
    const stateOk = prefs.states.length === 0 || production.jurisdictions.some((code) => prefs.states.includes(code));
    const typeOk =
      prefs.projectTypes.length === 0 ||
      prefs.projectTypes.some((type) => (production.projectType ?? "").toLowerCase().includes(type.toLowerCase()));
    const band = budgetBand(production);
    const bandOk = prefs.budgetBands.length === 0 || (band !== null && prefs.budgetBands.includes(band));
    const needs = likelyNeeds(production).map((need) => need.category);
    const vendorOk =
      prefs.vendorCategories.length === 0 ||
      prefs.vendorCategories.some((category) => needs.some((need) => need.toLowerCase().includes(category.toLowerCase())));
    return stateOk && typeOk && bandOk && vendorOk;
  });
  if (matched.length === 0) {
    return "Your territory\n\nNothing on the public board currently matches the states, project types, budget bands, and vendor categories you saved. That is an empty match, not a quiet week.";
  }
  const lines = matched.slice(0, 8).map((production) => {
    const needs = likelyNeeds(production);
    const needText = needs.length
      ? needs.map((need) => `likely needs ${need.category} (${need.reason})`).join("; ")
      : "no vendor category was derived";
    return `- ${production.title} (${production.company}; ${production.jurisdictions.join(", ")}). ${needText}. Sources: ${production.sources.map((source) => source.url).join(", ")}`;
  });
  return `Your territory\n\nThese are public-board matches for the preferences on your Shelf. "Likely needs" is a category guess from project type, published spend or credit, filming days, and location. It is not a purchase order.\n\n${lines.join("\n")}`;
}

export function productionsInLast12Months(productions: StoredProduction[], now: Date): StoredProduction[] {
  const cutoff = now.getTime() - 366 * 86_400_000;
  return productions.filter((production) => Date.parse(production.firstSeenAt) >= cutoff);
}

export function boardCsv(productions: StoredProduction[]): string {
  const header = [
    "title",
    "company",
    "jurisdictions",
    "project_type",
    "credit",
    "qualified_spend",
    "filming_days",
    "jobs",
    "status",
    "first_seen",
    "source_urls",
  ];
  const rows = productions.map((production) =>
    [
      production.title,
      production.company,
      production.jurisdictions.join("|"),
      production.projectType ?? "",
      production.credit ?? "",
      production.qualifiedSpend ?? "",
      production.filmingDays ?? "",
      production.jobs ?? "",
      production.status,
      production.firstSeenAt.slice(0, 10),
      production.sources.map((source) => source.url).join(" "),
    ]
      .map(csvCell)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/** Columns HubSpot and Salesforce company/deal imports both accept. */
export function crmImportCsv(productions: StoredProduction[]): string {
  const header = ["Company", "Deal Name", "State", "Website", "Description"];
  const rows = productions.map((production) => {
    const source = production.sources[0];
    const description = `Public production record. Status: ${production.status}. Credit: ${production.credit ?? "not published"}. Qualified spend: ${production.qualifiedSpend ?? "not published"}.`;
    return [production.company, production.title, production.jurisdictions.join("|"), source?.url ?? "", description]
      .map(csvCell)
      .join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export interface SpendReportInputs {
  monthKey: string;
  productions: StoredProduction[];
  filmLaShootDays: { quarter: string; days: number; sourceUrl: string } | null;
  studioHiringIndex: { label: string; sourceUrl: string; note: string } | null;
}

export function spendReportMarkdown(input: SpendReportInputs): string {
  const byState = new Map<string, { count: number; credits: string[] }>();
  for (const production of input.productions) {
    for (const code of production.jurisdictions) {
      const current = byState.get(code) ?? { count: 0, credits: [] };
      current.count += 1;
      if (production.credit) current.credits.push(production.credit);
      byState.set(code, current);
    }
  }
  const stateLines = [...byState.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, value]) => `- ${code}: ${value.count} productions on the board. Published credit figures, not summed: ${value.credits.join("; ") || "none published"}.`);
  const filmLa = input.filmLaShootDays
    ? `FilmLA reported ${input.filmLaShootDays.days} shoot days for ${input.filmLaShootDays.quarter}. Source: ${input.filmLaShootDays.sourceUrl}`
    : "FilmLA quarterly shoot days were not included. The public quarterly release was not retrieved for this draft, so no shoot-day number is stated.";
  const hiring = input.studioHiringIndex
    ? `${input.studioHiringIndex.label} ${input.studioHiringIndex.note} Source: ${input.studioHiringIndex.sourceUrl}`
    : "Studio hiring index was not included. No comparable careers-page snapshot was supplied for this draft.";
  return `# State of Production Spend — ${input.monthKey}

Draft for review. This is not published, and the site must not promise a monthly report until a draft is marked published.

## Approvals and credits by state

Counts are rows on the Greenlight Board. Credits are copied from the public source and are not added together.

${stateLines.join("\n") || "- No productions were on the board."}

## FilmLA

${filmLa}

## Studio hiring

${hiring}

Every figure above is either copied from a cited source or explicitly omitted.
`;
}

export function monthlyReportMayBePromised(statuses: string[]): boolean {
  return statuses.includes("published");
}

export interface WatchTarget {
  id: number;
  titleKey: string | null;
  companyKey: string | null;
}

export function watchHits(
  watches: WatchTarget[],
  production: StoredProduction,
  kind: "permit" | "registry" | "hiring" | "trade",
): { watchId: number; kind: string; detail: string; sourceUrl: string | null }[] {
  return watches
    .filter(
      (watch) =>
        (watch.titleKey && watch.titleKey === production.titleKey) ||
        (watch.companyKey && watch.companyKey === production.companyKey),
    )
    .map((watch) => ({
      watchId: watch.id,
      kind,
      detail: `${production.title} (${production.company}) appeared in ${kind}. Status: ${production.status}.`,
      sourceUrl: production.sources.at(-1)?.url ?? null,
    }));
}

export function searchProductions(productions: StoredProduction[], query: string): StoredProduction[] {
  const needle = normalizeKey(query);
  if (!needle) return productions;
  return productions.filter((production) => {
    const haystack = normalizeKey(`${production.title} ${production.company} ${production.jurisdictions.join(" ")} ${production.status}`);
    return haystack.includes(needle);
  });
}
