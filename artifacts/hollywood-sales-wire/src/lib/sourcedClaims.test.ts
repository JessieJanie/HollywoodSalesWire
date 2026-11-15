import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  CALIFORNIA_FIRST_YEAR_CLAIM,
  CALIFORNIA_PROGRAM_SOURCE_DATE,
  CALIFORNIA_PROGRAM_SOURCE_URL,
  DELIVERY_LINE,
  GUARANTEE_WITHOUT_MONTHLY_REPORT,
  MEMBERSHIP_INCLUDES_LINE,
} from "./sourcedClaims";

const root = path.resolve(import.meta.dirname, "../../../../");

const GENERATED_CLAIM_FILES = [
  "artifacts/hollywood-sales-wire/src/pages/SalesPage.tsx",
  "artifacts/hollywood-sales-wire/src/pages/OrderPage.tsx",
  "artifacts/hollywood-sales-wire/src/lib/publicPricing.ts",
  "artifacts/hollywood-sales-wire/public/llms.txt",
  "artifacts/hollywood-sales-wire/index.html",
  "artifacts/hollywood-sales-wire/src/components/layout/Shell.tsx",
  "artifacts/api-server/src/lib/emailSequence.ts",
  "artifacts/api-server/src/lib/coldCampaigns.ts",
];

describe("sourced California claim", () => {
  it("dates the figures and uses the Commission's projected wording", () => {
    expect(CALIFORNIA_FIRST_YEAR_CLAIM).toContain("July 7, 2026");
    expect(CALIFORNIA_FIRST_YEAR_CLAIM).toContain("projects");
    expect(CALIFORNIA_FIRST_YEAR_CLAIM).toContain("170 projects");
    expect(CALIFORNIA_FIRST_YEAR_CLAIM).toContain("$6.6 billion");
    expect(CALIFORNIA_FIRST_YEAR_CLAIM).not.toContain("Three weeks ago");
    expect(CALIFORNIA_PROGRAM_SOURCE_DATE).toBe("2026-07-07");
    expect(CALIFORNIA_PROGRAM_SOURCE_URL).toContain("film.ca.gov");
  });

  it("does not promise a monthly report that does not exist", () => {
    expect(MEMBERSHIP_INCLUDES_LINE).not.toMatch(/Divergence/i);
    expect(GUARANTEE_WITHOUT_MONTHLY_REPORT).not.toMatch(/Divergence/i);
    expect(DELIVERY_LINE).not.toMatch(/12 per year/);
  });
});

describe("generated public copy", () => {
  it.each(GENERATED_CLAIM_FILES)("%s drops the undated and monthly-report claims", (relativePath) => {
    const text = readFileSync(path.join(root, relativePath), "utf8");
    expect(text).not.toContain("Three weeks ago");
    expect(text).not.toContain("We report it first, others report it months later");
    expect(text).not.toContain("12 issues of The Divergence Report");
    expect(text).not.toContain("twelve Divergence Reports");
    expect(text).not.toContain("12 monthly Divergence Reports");
    expect(text).not.toContain("three Divergence Reports");
  });
});
