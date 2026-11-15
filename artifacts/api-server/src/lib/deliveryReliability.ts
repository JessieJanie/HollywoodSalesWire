/**
 * Pure rules for the Monday research run.
 *
 * A run left in `running` after its process dies (autoscale, crash) holds the
 * week_key lock forever. These rules close that row, or retry it once when
 * the week is still the one being researched. They also decide when the
 * publisher should hear that Monday's draft or Tuesday's send is late.
 */

export const PT = "America/Los_Angeles";

/** Longer than a healthy research pass; short enough that a hung run cannot sit for weeks. */
export const RESEARCH_RUN_TIMEOUT_MS = 45 * 60 * 1000;

export const STALE_RUN_CLOSE_ERROR =
  "Closed by the stale-run reaper: this run stayed in 'running' past the research timeout, and its week is no longer the current research week, so it was not retried.";

export const STALE_RUN_RETRY_ERROR =
  "Closed by the stale-run reaper after exceeding the research timeout. One automatic retry was started for the current week.";

export const STALE_RUN_GAVE_UP_ERROR =
  "Closed by the stale-run reaper: this run exceeded the research timeout again after one automatic retry. Press Run research now to retry it yourself.";

export const RUN_TIMEOUT_ERROR =
  "Research run exceeded the 45-minute timeout and was closed so it cannot stay in 'running'.";

export type StaleRunDecision =
  | { action: "leave" }
  | { action: "close"; error: string }
  | { action: "retry"; error: string };

export function decideStaleRun(input: {
  status: string;
  startedAt: Date;
  weekKey: string;
  now: Date;
  currentWeekKey: string;
  /** True when this row was already retried once by the reaper. */
  alreadyRetried: boolean;
  timeoutMs?: number;
}): StaleRunDecision {
  if (input.status !== "running") return { action: "leave" };
  const timeoutMs = input.timeoutMs ?? RESEARCH_RUN_TIMEOUT_MS;
  if (input.now.getTime() - input.startedAt.getTime() < timeoutMs) return { action: "leave" };
  if (input.weekKey !== input.currentWeekKey) {
    return { action: "close", error: STALE_RUN_CLOSE_ERROR };
  }
  if (input.alreadyRetried) return { action: "close", error: STALE_RUN_GAVE_UP_ERROR };
  return { action: "retry", error: STALE_RUN_RETRY_ERROR };
}

export function staleRetryAlertKey(runId: number): string {
  return `stale-retry:${runId}`;
}

export function draftLateAlertKey(weekKey: string): string {
  return `draft-not-ready:${weekKey}`;
}

export function issueLateAlertKey(weekKey: string): string {
  return `issue-not-sent:${weekKey}`;
}

type PtDate = { year: number; month: number; day: number };

/** Monday (YYYY-MM-DD) of the Pacific calendar week containing `now`. */
export function pacificMonday(now: Date): string {
  const date = pacificDate(now);
  const utc = new Date(Date.UTC(date.year, date.month - 1, date.day));
  const dow = utc.getUTCDay(); // 0 Sun .. 6 Sat
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  utc.setUTCDate(utc.getUTCDate() - daysFromMonday);
  return utc.toISOString().slice(0, 10);
}

/** Tuesday 5:00 AM Pacific of the current research week. */
export function draftReadyDeadlineMs(now: Date): number {
  return pacificLocalToUtcMs(addCalendarDays(pacificMonday(now), 1), 5, 0);
}

/** Tuesday 12:00 PM Pacific of the current research week. */
export function issueSentDeadlineMs(now: Date): number {
  return pacificLocalToUtcMs(addCalendarDays(pacificMonday(now), 1), 12, 0);
}

function nextMondayMs(now: Date): number {
  return pacificLocalToUtcMs(addCalendarDays(pacificMonday(now), 7), 0, 0);
}

/** Monday's draft is late from Tuesday 5:00 AM PT until the next Monday. */
export function draftAlertDue(now: Date): boolean {
  const t = now.getTime();
  return t >= draftReadyDeadlineMs(now) && t < nextMondayMs(now);
}

/** Tuesday's paid issue is late from Tuesday 12:00 PM PT until the next Monday. */
export function sendAlertDue(now: Date): boolean {
  const t = now.getTime();
  return t >= issueSentDeadlineMs(now) && t < nextMondayMs(now);
}

function pacificDate(instant: Date): PtDate {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function addCalendarDays(iso: string, days: number): PtDate {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function pacificLocalToUtcMs(date: PtDate, hour: number, minute: number): number {
  const utcGuess = Date.UTC(date.year, date.month - 1, date.day, hour, minute, 0);
  const offsetAtGuess = ptOffsetMs(new Date(utcGuess));
  let utc = utcGuess - offsetAtGuess;
  const offsetAtResult = ptOffsetMs(new Date(utc));
  if (offsetAtResult !== offsetAtGuess) utc = utcGuess - offsetAtResult;
  return utc;
}

/** Milliseconds to add to a UTC instant to get the America/Los_Angeles wall clock. */
function ptOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
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
