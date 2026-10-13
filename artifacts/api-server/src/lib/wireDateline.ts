/**
 * Publication dates belong to the issue's Monday week key, not to the model
 * or the server's timezone. This also works for early/late research runs.
 */
export function wirePublicationDate(weekKey: string): string {
  const monday = new Date(`${weekKey}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(weekKey) ||
    !Number.isFinite(monday.getTime()) ||
    monday.toISOString().slice(0, 10) !== weekKey ||
    monday.getUTCDay() !== 1
  ) {
    throw new Error("Wire week key must be a valid Monday (YYYY-MM-DD).");
  }
  monday.setUTCDate(monday.getUTCDate() + 1);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(monday);
}

const DATE = /(?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}/i;
const TITLE = /^(?:#{1,6}\s*)?(?:Hollywood Sales Wire|HSW Weekly Wire)\b/i;

/** Only touch the masthead; never rewrite dates in reporting or receipts. */
export function normalizeWireDateline(markdown: string, weekKey: string): string {
  const date = wirePublicationDate(weekKey);
  const lines = markdown.split("\n");
  const first = lines.findIndex((line) => line.trim().length > 0);
  if (first < 0) throw new Error("Wire body is empty.");
  const title = lines[first];
  if (!TITLE.test(title)) {
    return `# Hollywood Sales Wire\n**${date}**\n\n${markdown}`;
  }
  const inlineDate = DATE.test(title);
  if (inlineDate) lines[first] = title.replace(DATE, date);

  // A standalone dateline may follow the title, optionally after blank lines.
  let next = first + 1;
  while (next < lines.length && !lines[next].trim()) next++;
  const candidate = (lines[next] ?? "").trim().replace(/^[#*_]+\s*|\s*[*_]+$/g, "");
  const withoutDate = candidate.replace(/^(?:Week of|Issue date:?)\s+/i, "").replace(DATE, "").trim();
  const standaloneDate = DATE.test(candidate) && withoutDate === "";
  if (standaloneDate) {
    lines[next] = lines[next].replace(DATE, date);
  } else if (!inlineDate) {
    lines.splice(first + 1, 0, `**${date}**`);
  }
  return lines.join("\n");
}
