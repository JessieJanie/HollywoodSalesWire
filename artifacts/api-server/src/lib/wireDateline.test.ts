import { describe, expect, it } from "vitest";
import { normalizeWireDateline, wirePublicationDate } from "./wireDateline";

describe("Wire publication calendar", () => {
  it.each([
    ["2026-10-12", "Tuesday, October 13, 2026"],
    ["2026-10-05", "Tuesday, October 6, 2026"],
    ["2026-08-31", "Tuesday, September 1, 2026"],
    ["2029-12-31", "Tuesday, January 1, 2030"],
    ["2028-02-28", "Tuesday, February 29, 2028"],
    ["2026-03-09", "Tuesday, March 10, 2026"],
    ["2026-11-02", "Tuesday, November 3, 2026"],
  ])("%s produces %s independently of run time", (key, expected) => {
    expect(wirePublicationDate(key)).toBe(expected);
  });
  it.each(["bad", "2026-02-30", "2026-10-13"])("rejects invalid week %s", (key) => {
    expect(() => wirePublicationDate(key)).toThrow("valid Monday");
  });
});

describe("Wire masthead guard", () => {
  const date = "Tuesday, October 13, 2026";
  const body = "\n\n---\n\nFilming begins Wednesday, October 14, 2026.\nSource: example.com/2026-10-14";
  it("fixes the reported date without changing any reporting", () => {
    const original = `# Hollywood Sales Wire\n**Tuesday, October 14, 2026**${body}`;
    expect(normalizeWireDateline(original, "2026-10-12"))
      .toBe(original.replace("Tuesday, October 14, 2026", date));
  });
  it.each([
    "# Hollywood Sales Wire — Tuesday, October 14, 2026",
    "# Hollywood Sales Wire\n\nTuesday, October 14, 2026",
    "HSW Weekly Wire\nWeek of October 14, 2026",
    "# Hollywood Sales Wire\n**2026-10-14**",
  ])("handles masthead format %s", (header) => {
    const result = normalizeWireDateline(header + body, "2026-10-12");
    expect(result).toContain(date);
    expect(result.endsWith(body)).toBe(true);
    expect(normalizeWireDateline(result, "2026-10-12")).toBe(result);
  });
  it("adds a missing dateline without altering the first article's date", () => {
    const original = `# Hollywood Sales Wire${body}`;
    expect(normalizeWireDateline(original, "2026-10-12")).toBe(
      `# Hollywood Sales Wire\n**${date}**${body}`,
    );
  });
  it("adds a masthead to title-less content", () => {
    expect(normalizeWireDateline(body, "2026-10-12"))
      .toBe(`# Hollywood Sales Wire\n**${date}**\n\n${body}`);
  });
  it("leaves a correct issue byte-for-byte unchanged", () => {
    const original = `# Hollywood Sales Wire\n**${date}**${body}`;
    expect(normalizeWireDateline(original, "2026-10-12")).toBe(original);
  });
});
