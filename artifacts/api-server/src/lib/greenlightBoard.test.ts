import { describe, expect, it } from "vitest";
import {
  boardCsv,
  crmImportCsv,
  likelyNeeds,
  mergeProduction,
  monthlyReportMayBePromised,
  nycFreshness,
  parseCaCells,
  parseNycPermit,
  searchProductions,
  spendReportMarkdown,
  watchHits,
  yourTerritory,
  type BoardSource,
  type StoredProduction,
} from "./greenlightBoard";

const source = (url: string, status = "ok"): BoardSource => ({
  url,
  label: url,
  status,
  fetchedAt: "2026-11-15T00:00:00.000Z",
});

const ca = parseCaCells(
  ["2026-2027", "Michael 2 (working title)*", "LIONSGATE", "Non-Independent Feature Film Live Action", "Non-Independent", "55", "65", "300", "5220", "$86,725,000", "$30,837,000", "9/21/2026"],
  source("https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/"),
)!;

describe("Greenlight Board", () => {
  it("dedupes on title and company, keeps the first-seen date, and keeps every source", () => {
    const first = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const again = mergeProduction(
      first,
      { ...ca, jurisdiction: "NY", status: "also listed", source: source("https://esd.ny.gov/example") },
      "2026-11-01T00:00:00.000Z",
    );
    expect(again.firstSeenAt).toBe("2026-09-21T00:00:00.000Z");
    expect(again.titleKey).toBe("michael 2 working title");
    expect(again.companyKey).toBe("lionsgate");
    expect(again.jurisdictions).toEqual(["CA", "NY"]);
    expect(again.sources).toHaveLength(2);
    expect(again.status).toBe("also listed");
  });

  it("labels vendor categories as likely needs and does not invent a purchase", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const needs = likelyNeeds(stored);
    expect(needs.every((need) => need.label === "likely needs")).toBe(true);
    expect(needs.map((need) => need.category).join(" ")).toContain("locations");
    expect(needs.map((need) => need.category).join(" ")).toContain("payroll");
    expect(JSON.stringify(needs)).not.toMatch(/will buy|awarded to|purchase order is/i);
  });

  it("does not treat an animation row with no filming days as a location shoot", () => {
    const animation = parseCaCells(
      ["2026-2027", "Pixar Film TBA*", "Pixar", "Non-Independent Feature Film Animation", "Non-Independent", "-", "20", "638", "-", "$114,641,000", "$40,124,000"],
      source("https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/"),
    )!;
    const stored = mergeProduction(undefined, animation, "2026-09-21T00:00:00.000Z");
    const categories = likelyNeeds(stored).map((need) => need.category);
    expect(categories.join(" ")).toContain("animation");
    expect(categories.join(" ")).not.toContain("locations");
  });

  it("marks the August 2026 NYC permit extract as stale on November 15", () => {
    const freshness = nycFreshness("2026-08-15T14:00:00.000", new Date("2026-11-15T18:00:00.000Z"));
    expect(freshness.stale).toBe(true);
    expect(freshness.detail).toContain("2026-08-15");
    const permit = parseNycPermit(
      { eventid: "1", eventtype: "Shooting Permit", category: "Television", subcategoryname: "Episodic series", startdatetime: "2026-08-15T14:00:00.000" },
      source("https://data.cityofnewyork.us/resource/tg4x-b46p.json"),
      freshness,
    )!;
    expect(permit.status).toContain("stale");
    expect(permit.source.status).toContain("2026-08-15");
  });

  it("builds a territory section only from saved preferences and labels guesses", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const text = yourTerritory(
      { states: ["CA"], projectTypes: ["Live Action"], budgetBands: ["$40 million and up"], vendorCategories: ["payroll"] },
      [stored],
    );
    expect(text.startsWith("Your territory")).toBe(true);
    expect(text).toContain("likely needs");
    expect(text).toContain("not a purchase order");
    expect(yourTerritory({ states: ["GA"], projectTypes: [], budgetBands: [], vendorCategories: [] }, [stored])).toContain("empty match");
  });

  it("exports twelve-month board rows and a CRM import file", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const csv = boardCsv([stored]);
    expect(csv).toContain("Michael 2 (working title)");
    expect(csv).toContain("film.ca.gov");
    const crm = crmImportCsv([stored]);
    expect(crm.split("\n")[0]).toBe("Company,Deal Name,State,Website,Description");
    expect(crm).toContain("LIONSGATE");
  });

  it("drafts a monthly report without inventing FilmLA or hiring numbers", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const markdown = spendReportMarkdown({
      monthKey: "2026-11",
      productions: [stored],
      filmLaShootDays: null,
      studioHiringIndex: null,
    });
    expect(markdown).toContain("CA: 1 productions");
    expect(markdown).toContain("$30,837,000");
    expect(markdown).toContain("not included");
    expect(markdown).not.toMatch(/FilmLA reported \d/);
    expect(monthlyReportMayBePromised(["draft"])).toBe(false);
    expect(monthlyReportMayBePromised(["draft", "published"])).toBe(true);
  });

  it("flags a watch when the title or company shows up in a permit, registry, hiring note, or trade", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z");
    const hits = watchHits([{ id: 4, titleKey: stored.titleKey, companyKey: null }], stored, "registry");
    expect(hits).toEqual([
      expect.objectContaining({ watchId: 4, kind: "registry", sourceUrl: stored.sources[0]?.url }),
    ]);
    expect(watchHits([{ id: 5, titleKey: "other", companyKey: "other co" }], stored, "trade")).toEqual([]);
  });

  it("searches title and company", () => {
    const stored = mergeProduction(undefined, ca, "2026-09-21T00:00:00.000Z") satisfies StoredProduction;
    expect(searchProductions([stored], "lions").map((row) => row.titleKey)).toEqual([stored.titleKey]);
    expect(searchProductions([stored], "no such film")).toEqual([]);
  });
});
