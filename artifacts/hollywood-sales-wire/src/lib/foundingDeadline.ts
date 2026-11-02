/**
 * Founding-offer deadline.
 *
 * One pure function of (current instant, ?d=YYYY-MM-DD). No deadline is
 * inferred when the parameter is missing or invalid. A valid Monday deadline
 * closes at 11:59:59 PM Eastern on that date.
 */

export const NY_TIME_ZONE = "America/New_York";
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
  /** YYYY-MM-DD in America/New_York, or null when no valid date was supplied. */
  date: string | null;
  /** "Monday, October 19, 2026", or null without a valid date. */
  label: string | null;
  /** Human-readable deadline copy, or null without a valid date. */
  endsPhrase: string | null;
  endedPhrase: string | null;
  /** Whole NY calendar days from `now` until the date. */
  daysLeft: number | null;
  daysLeftLabel: string | null;
  /** True when there is no valid deadline or its closing instant has passed. */
  closed: boolean;
  /**
   * The valid ?d= value while the offer remains open. Never invent a date.
   */
  overrideDate: string | null;
  /** Deadline instant in UTC milliseconds, or null without a valid date. */
  endsAtMs: number | null;
};

export function resolveFoundingDeadline(
  now: Date,
  rawParam: string | null | undefined,
): FoundingDeadline {
  const today = nyDateFromInstant(now);
  const date = parseDeadline(rawParam);
  const endsAtMs = date ? nyDeadlineMs(date) : null;
  const daysLeft = date ? diffDays(today, date) : null;
  const label = date ? formatLabel(date) : null;
  const closed = endsAtMs === null || now.getTime() > endsAtMs;
  return {
    date: date ? formatIso(date) : null,
    label,
    endsPhrase: label ? `ends ${label} at 11:59 PM ET` : null,
    endedPhrase: label ? `ended ${label} at 11:59 PM ET` : null,
    daysLeft,
    daysLeftLabel:
      daysLeft === null ? null : daysLeft === 1 ? "1 day left" : `${daysLeft} days left`,
    closed,
    overrideDate: date && !closed ? formatIso(date) : null,
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

function parseDeadline(raw: string | null | undefined): NyDate | null {
  if (raw == null || raw === "") return null;
  const match = DATE_RE.exec(raw);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isRealDate(year, month, day)) return null;
  const date = { year, month, day };
  if (weekdayIndex(date) !== 1) return null;
  return date;
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
