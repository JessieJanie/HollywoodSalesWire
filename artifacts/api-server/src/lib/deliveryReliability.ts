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
  return `draft-missing:${weekKey}`;
}

export function issueLateAlertKey(weekKey: string): string {
  return `issue-not-sent:${weekKey}`;
}

export type PacificClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  /** Sun, Mon, Tue, Wed, Thu, Fri, Sat */
  weekday: string;
};

/** Wall clock in America/Los_Angeles. Weekday comes from the same zoned date. */
export function pacificClock(now: Date): PacificClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PT,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const raw = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  let hour = Number(raw("hour"));
  if (hour === 24) hour = 0;
  return {
    year: Number(raw("year")),
    month: Number(raw("month")),
    day: Number(raw("day")),
    hour,
    minute: Number(raw("minute")),
    weekday: raw("weekday"),
  };
}

export type DeliveryAlert =
  | { action: "none" }
  | { action: "draft-missing"; weekKey: string; alertKey: string; text: string }
  | { action: "issue-not-sent"; weekKey: string; alertKey: string; text: string };

/**
 * Deadline mail is only for this Tuesday, after the threshold, and only for
 * this Tuesday's Monday week key. A missing draft is "draft missing", never
 * "not sent". A closed or reaped past week is silent.
 */
export function deliveryAlert(input: {
  now: Date;
  /** Monday week key of the row being considered. */
  weekKey: string;
  /** none when no research row exists. */
  runStatus: string;
  /** True when a ready draft has body text. */
  hasReadyDraft: boolean;
  /** null when no paid-send row exists. */
  paidStatus: string | null;
}): DeliveryAlert {
  const currentWeek = pacificMonday(input.now);
  if (input.weekKey !== currentWeek) return { action: "none" };
  const clock = pacificClock(input.now);
  if (clock.weekday !== "Tue") return { action: "none" };
  const minutes = clock.hour * 60 + clock.minute;
  if (minutes < 5 * 60) return { action: "none" };
  if (!input.hasReadyDraft || input.runStatus !== "ready") {
    const status = input.runStatus === "none" ? "not started" : input.runStatus;
    return {
      action: "draft-missing",
      weekKey: input.weekKey,
      alertKey: draftLateAlertKey(input.weekKey),
      text: `Karilyn,\n\nIt is Tuesday after 5:00 AM Pacific and the week of ${input.weekKey} has no ready draft (status: ${status}). This is a draft-missing alert, not a send alert. Nothing goes out until a draft exists.\n\n— Hollywood Sales Wire research desk`,
    };
  }
  if (minutes < 12 * 60) return { action: "none" };
  if (input.paidStatus === "sent" || input.paidStatus === "auto_sent_after_24h") return { action: "none" };
  const status = input.paidStatus ?? "not started";
  return {
    action: "issue-not-sent",
    weekKey: input.weekKey,
    alertKey: issueLateAlertKey(input.weekKey),
    text: `Karilyn,\n\nIt is Tuesday after 12:00 PM Pacific and the paid Wire for the week of ${input.weekKey} is ready but not sent (status: ${status}).\n\nOpen the publisher console and use Approve and send, or hold the draft if it should wait.\n\n— Hollywood Sales Wire research desk`,
  };
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

/** True only on Tuesday, at or after 5:00 AM Pacific. Not on later days of that week. */
export function draftAlertDue(now: Date): boolean {
  const clock = pacificClock(now);
  return clock.weekday === "Tue" && clock.hour * 60 + clock.minute >= 5 * 60;
}

/** True only on Tuesday, at or after 12:00 PM Pacific. */
export function sendAlertDue(now: Date): boolean {
  const clock = pacificClock(now);
  return clock.weekday === "Tue" && clock.hour * 60 + clock.minute >= 12 * 60;
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
