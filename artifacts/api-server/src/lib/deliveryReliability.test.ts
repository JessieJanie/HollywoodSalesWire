import { describe, expect, it } from "vitest";
import {
  RESEARCH_RUN_TIMEOUT_MS,
  STALE_RUN_CLOSE_ERROR,
  STALE_RUN_GAVE_UP_ERROR,
  STALE_RUN_RETRY_ERROR,
  decideStaleRun,
  draftAlertDue,
  draftLateAlertKey,
  draftReadyDeadlineMs,
  issueLateAlertKey,
  issueSentDeadlineMs,
  pacificMonday,
  sendAlertDue,
  staleRetryAlertKey,
} from "./deliveryReliability";

const WEEK = "2026-11-09";

function run(overrides: Partial<Parameters<typeof decideStaleRun>[0]> = {}) {
  return decideStaleRun({
    status: "running",
    startedAt: new Date("2026-10-26T17:00:00.000Z"),
    weekKey: "2026-10-26",
    now: new Date("2026-11-15T18:00:00.000Z"),
    currentWeekKey: WEEK,
    alreadyRetried: false,
    ...overrides,
  });
}

describe("decideStaleRun", () => {
  it("closes the October 26 and November 2 runs that are still marked running", () => {
    expect(run({ weekKey: "2026-10-26" })).toEqual({ action: "close", error: STALE_RUN_CLOSE_ERROR });
    expect(run({ weekKey: "2026-11-02", startedAt: new Date("2026-11-02T18:00:00.000Z") })).toEqual({
      action: "close",
      error: STALE_RUN_CLOSE_ERROR,
    });
  });

  it("leaves a run that is still inside the timeout", () => {
    const now = new Date("2026-11-09T18:00:00.000Z");
    expect(
      run({
        weekKey: WEEK,
        startedAt: new Date(now.getTime() - RESEARCH_RUN_TIMEOUT_MS + 1000),
        now,
      }).action,
    ).toBe("leave");
  });

  it("retries a current-week run once, then closes it", () => {
    const now = new Date("2026-11-09T20:00:00.000Z");
    const startedAt = new Date(now.getTime() - RESEARCH_RUN_TIMEOUT_MS - 1);
    expect(run({ weekKey: WEEK, startedAt, now })).toEqual({ action: "retry", error: STALE_RUN_RETRY_ERROR });
    expect(run({ weekKey: WEEK, startedAt, now, alreadyRetried: true })).toEqual({
      action: "close",
      error: STALE_RUN_GAVE_UP_ERROR,
    });
  });

  it("does not touch a ready or failed row", () => {
    expect(run({ status: "ready" }).action).toBe("leave");
    expect(run({ status: "failed" }).action).toBe("leave");
  });
});

describe("publisher deadlines", () => {
  it("uses the Pacific Monday as the week key", () => {
    // Sunday Nov 15, 2026, 10:00 AM PT (PST, UTC-8) is still the week of Monday Nov 9.
    expect(pacificMonday(new Date("2026-11-15T18:00:00.000Z"))).toBe("2026-11-09");
    // Monday Nov 16, 2026, 12:30 AM PT starts the next week.
    expect(pacificMonday(new Date("2026-11-16T08:30:00.000Z"))).toBe("2026-11-16");
  });

  it("places the draft deadline at Tuesday 5:00 AM PT and the send deadline at Tuesday noon PT", () => {
    const sunday = new Date("2026-11-15T18:00:00.000Z");
    expect(new Date(draftReadyDeadlineMs(sunday)).toISOString()).toBe("2026-11-10T13:00:00.000Z");
    expect(new Date(issueSentDeadlineMs(sunday)).toISOString()).toBe("2026-11-10T20:00:00.000Z");
  });

  it("alerts for a missing Monday draft from Tuesday 5:00 AM PT until the next Monday", () => {
    expect(draftAlertDue(new Date("2026-11-10T12:59:00.000Z"))).toBe(false);
    expect(draftAlertDue(new Date("2026-11-10T13:00:00.000Z"))).toBe(true);
    expect(draftAlertDue(new Date("2026-11-15T18:00:00.000Z"))).toBe(true);
    expect(draftAlertDue(new Date("2026-11-16T08:00:00.000Z"))).toBe(false);
  });

  it("alerts for an unsent Tuesday issue from Tuesday noon PT until the next Monday", () => {
    expect(sendAlertDue(new Date("2026-11-10T19:59:00.000Z"))).toBe(false);
    expect(sendAlertDue(new Date("2026-11-10T20:00:00.000Z"))).toBe(true);
    expect(sendAlertDue(new Date("2026-11-11T16:00:00.000Z"))).toBe(true);
    expect(sendAlertDue(new Date("2026-11-16T07:59:00.000Z"))).toBe(true);
    expect(sendAlertDue(new Date("2026-11-16T08:00:00.000Z"))).toBe(false);
  });

  it("dedupes each notice per run or week", () => {
    expect(staleRetryAlertKey(42)).toBe("stale-retry:42");
    expect(draftLateAlertKey("2026-11-09")).toBe("draft-not-ready:2026-11-09");
    expect(issueLateAlertKey("2026-11-09")).toBe("issue-not-sent:2026-11-09");
  });
});
