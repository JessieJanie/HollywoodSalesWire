import { describe, expect, it } from "vitest";
import { renderSamplePage, sampleSourcesFromRun } from "./sampleIssue";

describe("public sample page", () => {
  it("renders the chosen issue and only https source links", () => {
    const html = renderSamplePage(
      {
        weekKey: "2026-11-09",
        subject: "Week of November 9",
        bodyText: "A real paid issue.",
        sources: sampleSourcesFromRun([
          { url: "https://film.ca.gov/tax-credit/", label: "California Film Commission" },
          { url: "http://insecure.example/nope", label: "Drop me" },
          { url: "not a url", label: "Drop me too" },
        ]),
      },
      "https://hollywoodsaleswire.com",
    );
    expect(html).toContain("A real paid issue.");
    expect(html).toContain("Week of 2026-11-09");
    expect(html).toContain('href="https://film.ca.gov/tax-credit/"');
    expect(html).not.toContain("insecure.example");
    expect(html).toContain('href="https://hollywoodsaleswire.com/sample"');
  });

  it("says when no issue has been chosen", () => {
    const html = renderSamplePage(null, "https://hollywoodsaleswire.com");
    expect(html).toContain("has not selected a paid issue");
  });
});
