import { describe, expect, it } from "vitest";
import { briefAlreadyArchived, briefSitemapXml, pacificIssueDate } from "./briefArchive";

describe("brief archive dates", () => {
  it("uses the Pacific calendar date, including just before and after midnight", () => {
    expect(pacificIssueDate(new Date("2026-11-10T07:30:00.000Z"))).toBe("2026-11-09");
    expect(pacificIssueDate(new Date("2026-11-10T08:30:00.000Z"))).toBe("2026-11-10");
  });

  it("does not archive the same subject twice on the same Pacific day", () => {
    const sentAt = new Date("2026-11-10T16:00:00.000Z");
    const existing = [{ subject: "Week of Nov 10", sentAt }];
    expect(briefAlreadyArchived(existing, "Week of Nov 10", new Date("2026-11-10T18:00:00.000Z"))).toBe(true);
    expect(briefAlreadyArchived(existing, "A different brief", sentAt)).toBe(false);
  });

  it("writes sitemap lastmod from those real dates, including the index", () => {
    const xml = briefSitemapXml(
      [
        { subject: "Older", sentAt: new Date("2026-11-03T16:00:00.000Z") },
        { subject: "Newer", sentAt: new Date("2026-11-10T16:00:00.000Z") },
      ],
      "https://hollywoodsaleswire.com",
    );
    expect(xml).toContain("<loc>https://hollywoodsaleswire.com/briefs</loc><lastmod>2026-11-10</lastmod>");
    expect(xml).toContain("<loc>https://hollywoodsaleswire.com/briefs/2026-11-10</loc><lastmod>2026-11-10</lastmod>");
    expect(xml).toContain("<loc>https://hollywoodsaleswire.com/briefs/2026-11-03</loc><lastmod>2026-11-03</lastmod>");
  });
});
