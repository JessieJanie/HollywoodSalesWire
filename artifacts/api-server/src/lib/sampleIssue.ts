export interface SampleSource {
  url: string;
  label: string;
}

export interface SampleIssue {
  weekKey: string;
  subject: string;
  bodyText: string;
  sources: SampleSource[];
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Server-rendered public sample. Source links are the run's recorded URLs, not guessed. */
export function renderSamplePage(issue: SampleIssue | null, siteUrl: string): string {
  const title = issue
    ? `${issue.subject} — Sample issue — Hollywood Sales Wire`
    : "Sample issue — Hollywood Sales Wire";
  const body = issue
    ? `<p class="kicker">HSW Weekly Wire — sample issue</p>
<h1>${escapeHtml(issue.subject)}</h1>
<p class="date">Week of ${escapeHtml(issue.weekKey)}. This is one real paid issue the publisher chose to show. The rest of the archive stays on the Shelf for members.</p>
<div class="issue">${escapeHtml(issue.bodyText)}</div>
<h2>Sources</h2>
${
  issue.sources.length
    ? `<ul>${issue.sources
        .map(
          (source) =>
            `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.label || source.url)}</a></li>`,
        )
        .join("")}</ul>`
    : "<p>This issue was published without a stored source list.</p>"
}`
    : `<p class="kicker">HSW Weekly Wire</p>
<h1>Sample issue</h1>
<p>The publisher has not selected a paid issue to show here yet.</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${siteUrl}/sample" />
<meta name="robots" content="index, follow" />
<style>
  body{margin:0;background:#f6f5f2;color:#1a1a1a;font-family:Georgia,serif;line-height:1.6;}
  .wrap{max-width:720px;margin:0 auto;padding:32px 20px 64px;}
  .issue{white-space:pre-wrap;}
  a{color:#1d5c3a;}
</style>
</head>
<body>
<div class="wrap">
<p><a href="${siteUrl}/">&larr; hollywoodsaleswire.com</a></p>
${body}
</div>
</body>
</html>`;
}

export function sampleSourcesFromRun(sources: unknown): SampleSource[] {
  if (!Array.isArray(sources)) return [];
  return sources.flatMap((source) => {
    if (!source || typeof source !== "object") return [];
    const row = source as { url?: unknown; label?: unknown };
    if (typeof row.url !== "string" || !row.url.startsWith("https://")) return [];
    return [{ url: row.url, label: typeof row.label === "string" ? row.label : row.url }];
  });
}
