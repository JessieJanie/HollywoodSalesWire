import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARTICLES } from "./articles";
import { publicSitemapEntries, renderPublicSitemap } from "./publicSitemap";

describe("public sitemap lastmod", () => {
  it("uses each article and press release's own publication date", () => {
    const entries = publicSitemapEntries();
    for (const article of ARTICLES) {
      expect(entries.find((entry) => entry.path === `/articles/${article.slug}`)?.lastmod).toBe(article.datePublished);
    }
    expect(entries.find((entry) => entry.path === "/articles/some-would-call-this-crazy")?.lastmod).toBe("2026-07-31");
    expect(entries.find((entry) => entry.path === "/press/doodle-girl-season-2-registry-filings")?.lastmod).toBe("2026-08-05");
    expect(entries.find((entry) => entry.path === "/")?.lastmod).toBe("2026-11-15");
    expect(entries.find((entry) => entry.path === "/order")?.lastmod).toBe("2026-11-15");
    expect(entries.find((entry) => entry.path === "/faq")?.lastmod).toBeUndefined();
  });

  it("matches the committed sitemap.xml", () => {
    const file = readFileSync(path.resolve(import.meta.dirname, "../../public/sitemap.xml"), "utf8");
    expect(file).toBe(renderPublicSitemap());
  });
});
