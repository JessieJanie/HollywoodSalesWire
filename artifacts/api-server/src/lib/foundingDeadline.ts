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

/**
 * The instant 23:59:59 ET on the given ET calendar date (y/m/d, 1-indexed
 * month) expires. Shared by every "ends at end-of-day ET" deadline so DST
 * transitions (spring-forward/fall-back) are resolved the same way
 * everywhere instead of being re-derived per call site.
 */
function endOfEtDay(y: number, m: number, d: number): Date {
  // End of an ET day is 23:59:59 ET = 03:59:59 UTC next day (EDT, -4) or
  // 04:59:59 UTC (EST, -5). Try EDT first and verify against the actual
  // ET offset in effect on that date (handles the DST switch days too).
  for (const offset of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, 23 + offset, 59, 59));
    const check = etParts(candidate);
    if (check.hour === 23 && check.d === d) return candidate;
  }
  // Unreachable for US Eastern, but fail safe rather than silently.
  throw new Error("Could not resolve Eastern end-of-day");
}

/** The instant an N-day-out offer expires: 23:59:59 ET on the deadline day. */
export function offerDeadline(createdAt: Date, days: number): Date {
  const target = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
  const { y, m, d } = etParts(target);
  return endOfEtDay(y, m, d);
}

/**
 * The next Monday's 23:59:59 ET, treating "viewed on Monday" as that same
 * Monday rather than rolling forward a week — the cold-offer deadline is
 * always "this coming Monday, end of day", never more than 7 days out.
 * Calendar arithmetic is done on ET y/m/d parts (not the server's local
 * day), so the correct ET calendar date is used regardless of where this
 * runs or what time zone `now` was constructed in.
 */
export function nextMondayDeadline(now: Date = new Date()): Date {
  const { y, m, d } = etParts(now);
  // A date built from plain y/m/d via Date.UTC has no time-zone ambiguity,
  // so its UTC weekday equals the ET calendar weekday for that date.
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun ... 1=Mon
  const daysUntilMonday = (1 - dow + 7) % 7; // 0 when `now` is already Monday
  const target = new Date(Date.UTC(y, m - 1, d + daysUntilMonday));
  return endOfEtDay(target.getUTCFullYear(), target.getUTCMonth() + 1, target.getUTCDate());
}

/** Human label for the deadline instant, e.g. "Tuesday, August 18". */
export function offerDeadlineLabel(deadline: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(deadline);
}

/** The instant the offer expires: 23:59:59 ET on the deadline day. */
export function foundingDeadline(createdAt: Date): Date {
  return offerDeadline(createdAt, OFFER_DAYS);
}

/** Human label for the deadline day, e.g. "Tuesday, August 18". */
export function deadlineLabel(createdAt: Date): string {
  return offerDeadlineLabel(foundingDeadline(createdAt));
}
