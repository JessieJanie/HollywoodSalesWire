import { describe, expect, it } from "vitest";
import {
  RESEARCH_RUN_TIMEOUT_MS,
  STALE_RUN_CLOSE_ERROR,
  STALE_RUN_GAVE_UP_ERROR,
  STALE_RUN_RETRY_ERROR,
  decideStaleRun,
  deliveryAlert,
  draftAlertDue,
  draftLateAlertKey,
  draftReadyDeadlineMs,
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
    // Sunday Nov 15, 2026, 10:00 AM PT (PST, UTC-8) is still the calendar week of Monday Nov 9.
    expect(pacificMonday(new Date("2026-11-15T18:00:00.000Z"))).toBe("2026-11-09");
    // Monday Nov 16, 2026, 12:30 AM PT starts the next research week.
    expect(pacificMonday(new Date("2026-11-16T08:30:00.000Z"))).toBe("2026-11-16");
  });

  it("places the draft deadline at Tuesday 5:00 AM PT and the send deadline at Tuesday noon PT", () => {
    const sunday = new Date("2026-11-15T18:00:00.000Z");
    expect(new Date(draftReadyDeadlineMs(sunday)).toISOString()).toBe("2026-11-10T13:00:00.000Z");
    expect(new Date(issueSentDeadlineMs(sunday)).toISOString()).toBe("2026-11-10T20:00:00.000Z");
  });

  it("does not alert on Sunday or Monday, including the Sunday the Nov 9 alert misfired", () => {
    const sundayEarly = new Date("2026-11-15T08:37:00.000Z"); // Sun Nov 15, 12:37 AM PT
    expect(pacificMonday(sundayEarly)).toBe("2026-11-09");
    expect(deliveryAlert({ now: sundayEarly, weekKey: "2026-11-09", runStatus: "none", hasReadyDraft: false, paidStatus: null }).action).toBe("none");
    expect(sendAlertDue(sundayEarly)).toBe(false);
    expect(draftAlertDue(sundayEarly)).toBe(false);
    const monday = new Date("2026-11-16T17:00:00.000Z"); // Mon Nov 16, 9:00 AM PT
    expect(pacificMonday(monday)).toBe("2026-11-16");
    expect(deliveryAlert({ now: monday, weekKey: "2026-11-16", runStatus: "none", hasReadyDraft: false, paidStatus: null }).action).toBe("none");
  });

  it("on Tuesday distinguishes 11:59 AM from 12:01 PM, in both PST and PDT", () => {
    const cases = [
      ["2026-11-17T19:59:00.000Z", "2026-11-16"], // Tue 11:59 AM PST
      ["2026-11-17T20:01:00.000Z", "2026-11-16"], // Tue 12:01 PM PST
      ["2026-03-10T18:59:00.000Z", "2026-03-09"], // Tue 11:59 AM PDT
      ["2026-03-10T19:01:00.000Z", "2026-03-09"], // Tue 12:01 PM PDT
    ] as const;
    for (const [iso, week] of cases) {
      const now = new Date(iso);
      const beforeNoon = iso.endsWith("18:59:00.000Z") || iso.endsWith("19:59:00.000Z");
      const missing = deliveryAlert({ now, weekKey: week, runStatus: "none", hasReadyDraft: false, paidStatus: null });
      expect(missing.action).toBe("draft-missing");
      if (missing.action === "draft-missing") expect(missing.text).not.toContain("not sent");
      const ready = deliveryAlert({ now, weekKey: week, runStatus: "ready", hasReadyDraft: true, paidStatus: null });
      expect(ready.action).toBe(beforeNoon ? "none" : "issue-not-sent");
    }
  });

  it("does not call a missing draft a failed send, and stays quiet about a past closed week", () => {
    const tuesdayNoon = new Date("2026-11-17T20:01:00.000Z");
    const missing = deliveryAlert({
      now: tuesdayNoon,
      weekKey: "2026-11-16",
      runStatus: "none",
      hasReadyDraft: false,
      paidStatus: null,
    });
    expect(missing.action).toBe("draft-missing");
    const past = deliveryAlert({
      now: tuesdayNoon,
      weekKey: "2026-11-09",
      runStatus: "failed",
      hasReadyDraft: false,
      paidStatus: null,
    });
    expect(past.action).toBe("none");
    const sent = deliveryAlert({
      now: tuesdayNoon,
      weekKey: "2026-11-16",
      runStatus: "ready",
      hasReadyDraft: true,
      paidStatus: "sent",
    });
    expect(sent.action).toBe("none");
  });

  it("dedupes each notice once per week", () => {
    const tuesdayNoon = new Date("2026-11-17T20:01:00.000Z");
    const first = deliveryAlert({ now: tuesdayNoon, weekKey: "2026-11-16", runStatus: "ready", hasReadyDraft: true, paidStatus: "sending" });
    const second = deliveryAlert({ now: tuesdayNoon, weekKey: "2026-11-16", runStatus: "ready", hasReadyDraft: true, paidStatus: "sending" });
    expect(first.action).toBe("issue-not-sent");
    expect(second).toEqual(first);
    if (first.action === "issue-not-sent") expect(first.alertKey).toBe("issue-not-sent:2026-11-16");
    expect(draftLateAlertKey("2026-11-16")).toBe("draft-missing:2026-11-16");
    expect(staleRetryAlertKey(42)).toBe("stale-retry:42");
  });
});
