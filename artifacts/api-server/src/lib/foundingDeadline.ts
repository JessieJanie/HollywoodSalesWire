/**
 * Each newsletter subscriber's founding offer ends at midnight Eastern at the
 * end of the 42nd day after signup — the same day email 5 ("deadline day")
 * lands. (Series starts day 14 so prospects get 1–2 Free Editions first, then
 * one email a week.) The /founding-offer page enforces this for real.
 */

const ET = "America/New_York";
export const OFFER_DAYS = 42;

function etParts(d: Date): { y: number; m: number; d: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), hour: get("hour") % 24 };
}

/** The instant the offer expires: 23:59:59 ET on the deadline day. */
export function foundingDeadline(createdAt: Date): Date {
  const target = new Date(createdAt.getTime() + OFFER_DAYS * 24 * 60 * 60 * 1000);
  const { y, m, d } = etParts(target);
  // End of that ET day is 23:59:59 ET = 03:59:59 UTC next day (EDT, -4) or
  // 04:59:59 UTC (EST, -5). Try EDT first and verify.
  for (const offset of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, 23 + offset, 59, 59));
    const check = etParts(candidate);
    if (check.hour === 23 && check.d === d) return candidate;
  }
  // Unreachable for US Eastern, but fail safe rather than silently.
  throw new Error("Could not resolve Eastern end-of-day");
}

/** Human label for the deadline day, e.g. "Tuesday, August 18". */
export function deadlineLabel(createdAt: Date): string {
  const deadline = foundingDeadline(createdAt);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(deadline);
}
