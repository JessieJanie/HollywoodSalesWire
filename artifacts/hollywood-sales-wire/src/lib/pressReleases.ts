// Press releases for the public /press section.
// Copy is publisher-approved and mirrors what was distributed externally
// (e.g. on ProductionHUB) — do not reword without Karilyn's sign-off.

export type PressBlock =
  | { type: "h2"; text: string }
  | { type: "p"; text: string };

export interface PressRelease {
  slug: string;
  title: string;
  description: string;
  datePublished: string; // ISO date
  dateline: string; // e.g. "LOS ANGELES — August 5, 2026"
  body: PressBlock[];
  mediaContact: string;
}

export const PRESS_RELEASES: PressRelease[] = [
  {
    slug: "doodle-girl-season-2-registry-filings",
    title: "Filings Point to a Second Season of Irish Animated Hit Doodle Girl",
    description:
      "Government registry filings in Northern Ireland and the Republic of Ireland point to a second season of the RTÉ Jr animated series Doodle Girl — ahead of any trade-press announcement.",
    datePublished: "2026-08-05",
    dateline: "LOS ANGELES — August 5, 2026",
    body: [
      {
        type: "p",
        text: "A second season of Doodle Girl, the Irish 2D animated preschool series from ALT Animation and Studio Meala that premiered on RTÉ Jr and earned four Irish Animation Award nominations, appears to be moving into production for a second season — according to government registry filings identified this week by Hollywood Sales Wire, ahead of any trade-press announcement.",
      },
      {
        type: "p",
        text: "On August 3, 2026, Doodle Girl UK S2 Ltd was incorporated in Bangor, County Down, Northern Ireland (Companies House no. NI742668, registered under television programme production activities). It joins Doodle Girl Series 2 DAC, registered in Ireland in October 2025 — a two-country corporate structure consistent with how cross-border Irish/Northern Irish animation co-productions are typically financed and staffed.",
      },
      {
        type: "p",
        text: "Neither production company has publicly announced a second season, and the filings themselves are the only public record to date. But per-season production vehicles are rarely formed speculatively: incorporation is typically followed within weeks by crew contracts, studio bookings, payroll enrollment, insurance, and vendor agreements on both sides of the border.",
      },
      {
        type: "p",
        text: "Hollywood Sales Wire is a weekly sales-intelligence briefing for companies that sell to the entertainment industry. A free weekly edition is available at hollywoodsaleswire.com.",
      },
    ],
    mediaContact: "Karilyn Colegrove — karilyn@hollywoodsaleswire.com",
  },
];

export function getPressRelease(slug: string): PressRelease | undefined {
  return PRESS_RELEASES.find((r) => r.slug === slug);
}
