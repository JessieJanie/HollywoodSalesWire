import assert from "node:assert/strict";
import { test } from "node:test";
import {
  orderPath,
  preserveDeadlineOnUrl,
  resolveFoundingDeadline,
} from "./foundingDeadline.ts";

/** 11:00 AM Eastern on Monday, October 12, 2026 (EDT, UTC-4). */
const MON_OCT_12 = new Date("2026-10-12T15:00:00.000Z");
/** 11:00 AM Eastern on Tuesday, October 13, 2026. */
const TUE_OCT_13 = new Date("2026-10-13T15:00:00.000Z");
/** 11:59:59.000 PM EDT on Monday, October 19, 2026. */
const OCT_19_DEADLINE_MS = Date.parse("2026-10-20T03:59:59.000Z");
/** 11:59:59.000 PM EST on Monday, November 9, 2026 (after DST ends). */
const NOV_9_DEADLINE_MS = Date.parse("2026-11-10T04:59:59.000Z");

test("a missing deadline is closed and does not invent a date", () => {
  const deadline = resolveFoundingDeadline(MON_OCT_12, null);
  assert.equal(deadline.date, null);
  assert.equal(deadline.label, null);
  assert.equal(deadline.endsAtMs, null);
  assert.equal(deadline.closed, true);
  assert.equal(deadline.overrideDate, null);
});

test("the same instant always resolves to the same deadline", () => {
  const a = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  const b = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  assert.deepEqual(a, b);
  assert.equal(a.date, "2026-10-20");
  assert.equal(a.label, "Tuesday, October 20, 2026");
  assert.equal(a.closed, false);
});

test("a missing date remains closed on every weekday", () => {
  const deadline = resolveFoundingDeadline(TUE_OCT_13, undefined);
  assert.equal(deadline.date, null);
  assert.equal(deadline.closed, true);
});

test("deadline after DST ends is 11:59:59 PM Eastern Standard Time", () => {
  // Monday, November 2, 2026, 11:00 AM EST. DST ended November 1.
  const now = new Date("2026-11-02T16:00:00.000Z");
  const deadline = resolveFoundingDeadline(now, "2026-11-09");
  assert.equal(deadline.date, "2026-11-09");
  assert.equal(deadline.endsAtMs, NOV_9_DEADLINE_MS);
  assert.equal(deadline.daysLeft, 7);
});

test("a future Monday date is the exact offer deadline", () => {
  const deadline = resolveFoundingDeadline(MON_OCT_12, "2026-10-19");
  assert.equal(deadline.date, "2026-10-19");
  assert.equal(deadline.label, "Monday, October 19, 2026");
  assert.equal(deadline.daysLeft, 7);
  assert.equal(deadline.daysLeftLabel, "7 days left");
  assert.equal(deadline.overrideDate, "2026-10-19");
  assert.equal(deadline.closed, false);
  assert.equal(deadline.endsPhrase, "ends Monday, October 19, 2026 at 11:59 PM ET");
});

test("today and later dates on any weekday are accepted", () => {
  const today = resolveFoundingDeadline(MON_OCT_12, "2026-10-12");
  assert.equal(today.date, "2026-10-12");
  assert.equal(today.daysLeft, 0);
  assert.equal(today.daysLeftLabel, "0 days left");
  assert.equal(today.overrideDate, "2026-10-12");
  assert.equal(today.closed, false);

  const later = resolveFoundingDeadline(MON_OCT_12, "2026-11-03");
  assert.equal(later.date, "2026-11-03");
  assert.equal(later.label, "Tuesday, November 3, 2026");
  assert.equal(later.overrideDate, "2026-11-03");
  assert.equal(later.closed, false);
});

test("missing, malformed, and unreal dates are closed", () => {
  const ignored = [
    "",
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-10",
    "2026-10-00",
    "2023-02-29",
    "2026-10-1",
    "10-19-2026",
    "2026-10-19T00:00:00Z",
    "2026-10-19 ",
    "foo",
    "",
  ];
  for (const raw of ignored) {
    const deadline = resolveFoundingDeadline(MON_OCT_12, raw);
    assert.equal(deadline.date, null, raw);
    assert.equal(deadline.closed, true, raw);
    assert.equal(deadline.overrideDate, null, raw);
  }
});

test("a passed deadline stays closed instead of rolling forward", () => {
  const afterMidnight = new Date("2026-10-20T04:00:00.000Z");
  const deadline = resolveFoundingDeadline(afterMidnight, "2026-10-19");
  assert.equal(deadline.date, "2026-10-19");
  assert.equal(deadline.label, "Monday, October 19, 2026");
  assert.equal(deadline.overrideDate, null);
  assert.equal(deadline.closed, true);
  assert.equal(deadline.endedPhrase, "ended Monday, October 19, 2026 at 11:59 PM ET");
});

test("a future Tuesday stays open through 11:59 PM Eastern", () => {
  const tuesday = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  assert.equal(tuesday.closed, false);
  assert.equal(tuesday.endsAtMs, Date.parse("2026-10-21T03:59:59.000Z"));
  assert.equal(tuesday.endsPhrase, "ends Tuesday, October 20, 2026 at 11:59 PM ET");

  const justAfterTuesdayDeadline = resolveFoundingDeadline(
    new Date(Date.parse("2026-10-21T03:59:59.001Z")),
    "2026-10-20",
  );
  assert.equal(justAfterTuesdayDeadline.closed, true);
  assert.equal(justAfterTuesdayDeadline.date, "2026-10-20");
});

test("the offer closes after 11:59:59 PM ET and stays open at that instant", () => {
  const atDeadline = new Date(OCT_19_DEADLINE_MS);
  const open = resolveFoundingDeadline(atDeadline, "2026-10-19");
  assert.equal(open.closed, false);
  assert.equal(open.daysLeft, 0);
  assert.equal(open.overrideDate, "2026-10-19");

  const justAfter = new Date(OCT_19_DEADLINE_MS + 1);
  const closed = resolveFoundingDeadline(justAfter, "2026-10-19");
  assert.equal(closed.closed, true);
  assert.equal(closed.date, "2026-10-19");
  assert.equal(closed.daysLeft, 0);
  assert.equal(closed.endedPhrase, "ended Monday, October 19, 2026 at 11:59 PM ET");
});

test("a passed calendar date does not silently roll forward", () => {
  const afterMidnight = new Date("2026-10-20T04:00:00.000Z");
  const deadline = resolveFoundingDeadline(afterMidnight, "2026-10-19");
  assert.equal(deadline.date, "2026-10-19");
  assert.equal(deadline.overrideDate, null);
  assert.equal(deadline.closed, true);
});

test("Eastern Standard Time close uses the UTC-5 instant", () => {
  const atDeadline = new Date(NOV_9_DEADLINE_MS);
  const open = resolveFoundingDeadline(atDeadline, "2026-11-09");
  assert.equal(open.closed, false);
  const closed = resolveFoundingDeadline(new Date(NOV_9_DEADLINE_MS + 1), "2026-11-09");
  assert.equal(closed.closed, true);
  assert.equal(closed.endsAtMs, NOV_9_DEADLINE_MS);
});

test("a valid deadline uses Eastern time rather than the host timezone", () => {
  // 03:30 UTC Oct 13 is still Monday Oct 12, 11:30 PM EDT.
  const late = new Date("2026-10-13T03:30:00.000Z");
  const deadline = resolveFoundingDeadline(late, "2026-10-19");
  assert.equal(deadline.date, "2026-10-19");
  assert.equal(deadline.daysLeft, 7);
});

test("checkout links keep a valid d and drop an ignored one", () => {
  const accepted = resolveFoundingDeadline(MON_OCT_12, "2026-10-19");
  assert.equal(
    preserveDeadlineOnUrl("https://buy.stripe.com/abc", accepted.overrideDate),
    "https://buy.stripe.com/abc?d=2026-10-19",
  );
  assert.equal(
    preserveDeadlineOnUrl("https://buy.stripe.com/abc?client_reference_id=shoot", accepted.overrideDate),
    "https://buy.stripe.com/abc?client_reference_id=shoot&d=2026-10-19",
  );
  assert.equal(orderPath(accepted.overrideDate), "/order?d=2026-10-19");

  const ignored = resolveFoundingDeadline(MON_OCT_12, "2026-02-31");
  assert.equal(preserveDeadlineOnUrl("https://buy.stripe.com/abc", ignored.overrideDate), "https://buy.stripe.com/abc");
  assert.equal(orderPath(ignored.overrideDate), "/order");
  assert.equal(orderPath(null), "/order");
});
