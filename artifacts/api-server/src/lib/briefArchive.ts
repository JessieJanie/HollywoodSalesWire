/** Pacific calendar date of a send, which is the archive URL and the sitemap lastmod. */
export function pacificIssueDate(sentAt: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(sentAt);
}

export function briefAlreadyArchived(
  existing: { subject: string; sentAt: Date }[],
  subject: string,
  sentAt: Date,
): boolean {
  const day = pacificIssueDate(sentAt);
  return existing.some((row) => row.subject === subject && pacificIssueDate(row.sentAt) === day);
}

export function briefSitemapXml(
  rows: { subject: string; sentAt: Date }[],
  siteUrl: string,
): string {
  const dates = rows.map((row) => pacificIssueDate(row.sentAt));
  const newest = dates.slice().sort().at(-1);
  const indexLastmod = newest ? `<lastmod>${newest}</lastmod>` : "";
  const urls = [
    `<url><loc>${siteUrl}/briefs</loc>${indexLastmod}<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
    ...rows.map((row) => {
      const day = pacificIssueDate(row.sentAt);
      return `<url><loc>${siteUrl}/briefs/${day}</loc><lastmod>${day}</lastmod><changefreq>yearly</changefreq><priority>0.6</priority></url>`;
    }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;
}
