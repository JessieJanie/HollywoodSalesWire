/**
 * Founding-offer deadline.
 *
 * One pure function of (current instant, optional ?d=YYYY-MM-DD). Nothing is
 * stored per visitor: the same instant and the same query produce the same
 * deadline for everyone.
 *
 * Default: the next Monday that is at least 7 days after the current
 * America/New_York calendar date, ending at 11:59:59 PM Eastern.
 *
 * ?d= is used only when it is a real calendar date, not before that NY date,
 * and at most 14 days ahead. Anything else is ignored and the default is used.
 * After 11:59:59 PM ET on the resolved date, the offer is closed.
 */

export const NY_TIME_ZONE = "America/New_York";
export const MIN_LEAD_DAYS = 7;
export const MAX_OVERRIDE_DAYS = 14;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type NyDate = {
  year: number;
  month: number;
  day: number;
};

export type FoundingDeadline = {
  /** YYYY-MM-DD in America/New_York. */
  date: string;
  /** "Monday, October 19, 2026" */
  label: string;
  /** "ends Monday, October 19, 2026 at 11:59 PM ET" */
  endsPhrase: string;
  /** "ended Monday, October 19, 2026 at 11:59 PM ET" */
  endedPhrase: string;
  /** Whole NY calendar days from `now` until `date`. 0 on the deadline date. */
  daysLeft: number;
  /** "7 days left" or "1 day left". */
  daysLeftLabel: string;
  /** True once 11:59:59 PM America/New_York on `date` has passed. */
  closed: boolean;
  /**
   * The accepted ?d= value. Null when the param was missing or ignored.
   * Checkout links preserve this and do not invent a param for the default.
   */
  overrideDate: string | null;
  /** 11:59:59.000 PM America/New_York on `date`, as a UTC epoch milliseconds. */
  endsAtMs: number;
};

export function resolveFoundingDeadline(
  now: Date,
  rawParam: string | null | undefined,
): FoundingDeadline {
  const today = nyDateFromInstant(now);
  const override = parseOverride(rawParam, today);
  const date = override ?? defaultMonday(today);
  const endsAtMs = nyDeadlineMs(date);
  const daysLeft = diffDays(today, date);
  const label = formatLabel(date);
  return {
    date: formatIso(date),
    label,
    endsPhrase: `ends ${label} at 11:59 PM ET`,
    endedPhrase: `ended ${label} at 11:59 PM ET`,
    daysLeft,
    daysLeftLabel: daysLeft === 1 ? "1 day left" : `${daysLeft} days left`,
    closed: now.getTime() > endsAtMs,
    overrideDate: override ? formatIso(override) : null,
    endsAtMs,
  };
}

/** Keep a validated ?d= on a checkout or in-app URL. Invalid params are not forwarded. */
export function preserveDeadlineOnUrl(url: string, overrideDate: string | null): string {
  if (!overrideDate) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}d=${encodeURIComponent(overrideDate)}`;
}

export function orderPath(overrideDate: string | null): string {
  return preserveDeadlineOnUrl("/order", overrideDate);
}

function parseOverride(raw: string | null | undefined, today: NyDate): NyDate | null {
  if (raw == null || raw === "") return null;
  const match = DATE_RE.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDate(year, month, day)) return null;
  const date = { year, month, day };
  const ahead = diffDays(today, date);
  if (ahead < 0 || ahead > MAX_OVERRIDE_DAYS) return null;
  return date;
}

/** Soonest Monday on or after today + 7 days. */
function defaultMonday(today: NyDate): NyDate {
  const earliest = addDays(today, MIN_LEAD_DAYS);
  const daysToMonday = (8 - weekdayIndex(earliest)) % 7;
  return addDays(earliest, daysToMonday);
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function weekdayIndex(date: NyDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function formatLabel(date: NyDate): string {
  return `${WEEKDAYS[weekdayIndex(date)]}, ${MONTHS[date.month - 1]} ${date.day}, ${date.year}`;
}

function formatIso(date: NyDate): string {
  const month = String(date.month).padStart(2, "0");
  const day = String(date.day).padStart(2, "0");
  return `${date.year}-${month}-${day}`;
}

function diffDays(from: NyDate, to: NyDate): number {
  return utcDayNumber(to) - utcDayNumber(from);
}

function utcDayNumber(date: NyDate): number {
  return Math.round(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

function addDays(date: NyDate, days: number): NyDate {
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day) + days * 86_400_000);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function nyDateFromInstant(instant: Date): NyDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/** 11:59:59.000 PM America/New_York on the given calendar date. */
function nyDeadlineMs(date: NyDate): number {
  return nyLocalToUtcMs(date, 23, 59, 59);
}

function nyLocalToUtcMs(date: NyDate, hour: number, minute: number, second: number): number {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, hour, minute, second);
  const offsetAtGuess = nyOffsetMs(new Date(utcGuess));
  let utc = utcGuess - offsetAtGuess;
  const offsetAtResult = nyOffsetMs(new Date(utc));
  if (offsetAtResult !== offsetAtGuess) utc = utcGuess - offsetAtResult;
  return utc;
}

/** Milliseconds to add to a UTC instant to get the America/New_York wall clock. */
function nyOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TIME_ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(value("hour"));
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    Number(value("year")),
    Number(value("month")) - 1,
    Number(value("day")),
    hour,
    Number(value("minute")),
    Number(value("second")),
  );
  return asUtc - instant.getTime();
}
