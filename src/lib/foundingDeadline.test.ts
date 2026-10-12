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

test("default on Monday Oct 12 2026 is Monday Oct 19 at 11:59 PM ET", () => {
  const deadline = resolveFoundingDeadline(MON_OCT_12, null);
  assert.equal(deadline.date, "2026-10-19");
  assert.equal(deadline.label, "Monday, October 19, 2026");
  assert.equal(deadline.endsPhrase, "ends Monday, October 19, 2026 at 11:59 PM ET");
  assert.equal(deadline.endedPhrase, "ended Monday, October 19, 2026 at 11:59 PM ET");
  assert.equal(deadline.daysLeft, 7);
  assert.equal(deadline.daysLeftLabel, "7 days left");
  assert.equal(deadline.closed, false);
  assert.equal(deadline.overrideDate, null);
  assert.equal(deadline.endsAtMs, OCT_19_DEADLINE_MS);
});

test("the same instant always resolves to the same deadline", () => {
  const a = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  const b = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  assert.deepEqual(a, b);
});

test("Tuesday rolls to the Monday that is at least 7 days out", () => {
  const deadline = resolveFoundingDeadline(TUE_OCT_13, undefined);
  assert.equal(deadline.date, "2026-10-26");
  assert.equal(deadline.daysLeft, 13);
  assert.equal(deadline.endsPhrase, "ends Monday, October 26, 2026 at 11:59 PM ET");
});

test("each weekday maps to a Monday at least 7 days ahead", () => {
  const cases: Array<[string, string, number]> = [
    ["2026-10-12T15:00:00.000Z", "2026-10-19", 7], // Mon
    ["2026-10-13T15:00:00.000Z", "2026-10-26", 13], // Tue
    ["2026-10-14T15:00:00.000Z", "2026-10-26", 12], // Wed
    ["2026-10-15T15:00:00.000Z", "2026-10-26", 11], // Thu
    ["2026-10-16T15:00:00.000Z", "2026-10-26", 10], // Fri
    ["2026-10-17T15:00:00.000Z", "2026-10-26", 9], // Sat
    ["2026-10-18T15:00:00.000Z", "2026-10-26", 8], // Sun
  ];
  for (const [iso, date, daysLeft] of cases) {
    const deadline = resolveFoundingDeadline(new Date(iso), null);
    assert.equal(deadline.date, date, iso);
    assert.equal(deadline.daysLeft, daysLeft, iso);
    assert.equal(deadline.closed, false);
  }
});

test("year boundary still lands on a Monday", () => {
  // Friday, December 25, 2026, 3:00 PM EST → +7 days is Friday Jan 1, next Monday Jan 4.
  const now = new Date("2026-12-25T20:00:00.000Z");
  const deadline = resolveFoundingDeadline(now, null);
  assert.equal(deadline.date, "2027-01-04");
  assert.equal(deadline.label, "Monday, January 4, 2027");
  assert.equal(deadline.daysLeft, 10);
  assert.equal(deadline.endsAtMs, Date.parse("2027-01-05T04:59:59.000Z"));
});

test("deadline after DST ends is 11:59:59 PM Eastern Standard Time", () => {
  // Monday, November 2, 2026, 11:00 AM EST. DST ended November 1.
  const now = new Date("2026-11-02T16:00:00.000Z");
  const deadline = resolveFoundingDeadline(now, null);
  assert.equal(deadline.date, "2026-11-09");
  assert.equal(deadline.endsAtMs, NOV_9_DEADLINE_MS);
  assert.equal(deadline.daysLeft, 7);
});

test("a real date inside the 14-day window overrides the default", () => {
  const deadline = resolveFoundingDeadline(MON_OCT_12, "2026-10-20");
  assert.equal(deadline.date, "2026-10-20");
  assert.equal(deadline.label, "Tuesday, October 20, 2026");
  assert.equal(deadline.daysLeft, 8);
  assert.equal(deadline.daysLeftLabel, "8 days left");
  assert.equal(deadline.overrideDate, "2026-10-20");
  assert.equal(deadline.closed, false);
  assert.equal(deadline.endsPhrase, "ends Tuesday, October 20, 2026 at 11:59 PM ET");
});

test("today and exactly 14 days ahead are accepted", () => {
  const today = resolveFoundingDeadline(MON_OCT_12, "2026-10-12");
  assert.equal(today.date, "2026-10-12");
  assert.equal(today.daysLeft, 0);
  assert.equal(today.daysLeftLabel, "0 days left");
  assert.equal(today.overrideDate, "2026-10-12");
  assert.equal(today.closed, false);

  const edge = resolveFoundingDeadline(MON_OCT_12, "2026-10-26");
  assert.equal(edge.date, "2026-10-26");
  assert.equal(edge.daysLeft, 14);
  assert.equal(edge.overrideDate, "2026-10-26");
});

test("one day left is singular", () => {
  const deadline = resolveFoundingDeadline(MON_OCT_12, "2026-10-13");
  assert.equal(deadline.daysLeftLabel, "1 day left");
});

test("past, too far, and unreal dates are ignored", () => {
  const ignored = [
    "2026-10-11",
    "2026-10-27",
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
    assert.equal(deadline.date, "2026-10-19", raw);
    assert.equal(deadline.overrideDate, null, raw);
  }
});

test("a real leap day is accepted when it falls inside the window", () => {
  const now = new Date("2028-02-20T15:00:00.000Z");
  const deadline = resolveFoundingDeadline(now, "2028-02-29");
  assert.equal(deadline.date, "2028-02-29");
  assert.equal(deadline.label, "Tuesday, February 29, 2028");
  assert.equal(deadline.overrideDate, "2028-02-29");
  assert.equal(deadline.daysLeft, 9);
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

test("a passed calendar date is ignored instead of shown as closed", () => {
  // Tuesday, October 20, 2026, 12:00 AM EDT. Oct 19 is yesterday, so ?d= is ignored.
  // The default Monday at least 7 days out is November 2 (Oct 26 is only 6 days away).
  const afterMidnight = new Date("2026-10-20T04:00:00.000Z");
  const deadline = resolveFoundingDeadline(afterMidnight, "2026-10-19");
  assert.equal(deadline.overrideDate, null);
  assert.equal(deadline.date, "2026-11-02");
  assert.equal(deadline.label, "Monday, November 2, 2026");
  assert.equal(deadline.daysLeft, 13);
  assert.equal(deadline.closed, false);
  assert.equal(deadline.endsAtMs, Date.parse("2026-11-03T04:59:59.000Z"));
});

test("Eastern Standard Time close uses the UTC-5 instant", () => {
  const atDeadline = new Date(NOV_9_DEADLINE_MS);
  const open = resolveFoundingDeadline(atDeadline, "2026-11-09");
  assert.equal(open.closed, false);
  const closed = resolveFoundingDeadline(new Date(NOV_9_DEADLINE_MS + 1), "2026-11-09");
  assert.equal(closed.closed, true);
  assert.equal(closed.endsAtMs, NOV_9_DEADLINE_MS);
});

test("NY date is taken from the Eastern calendar, not the host timezone", () => {
  // 03:30 UTC Oct 13 is still Monday Oct 12, 11:30 PM EDT.
  const late = new Date("2026-10-13T03:30:00.000Z");
  const deadline = resolveFoundingDeadline(late, null);
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
