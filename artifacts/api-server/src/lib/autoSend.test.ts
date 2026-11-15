import { describe, expect, it } from "vitest";
import {
  AUTO_SENT_STATUS,
  decideAutoSend,
  draftReadyAutoSendSentence,
  type AutoSendDraft,
} from "./autoSend";

const notified = new Date("2026-11-16T21:00:00.000Z"); // Monday 1:00 PM PT
const due = new Date(notified.getTime() + 24 * 60 * 60 * 1000);

function draft(overrides: Partial<AutoSendDraft> = {}): AutoSendDraft {
  return {
    weekKey: "2026-11-16",
    status: "ready",
    wireMarkdown: "W".repeat(120),
    freeSubject: "This week's brief",
    freeBody: "B".repeat(80),
    sources: [{ url: "https://film.ca.gov/tax-credit/", status: "ok", label: "CFC" }],
    draftReadyNotifiedAt: notified,
    autoSendHoldAt: null,
    autoSendState: null,
    ...overrides,
  };
}

describe("decideAutoSend", () => {
  it("sends the current week 24 hours after the review email", () => {
    const decision = decideAutoSend({
      draft: draft(),
      now: due,
      currentWeekKey: "2026-11-16",
      paidAlreadySent: false,
      briefAlreadySent: false,
    });
    expect(decision.action).toBe("send");
  });

  it("waits inside the 24 hours", () => {
    const decision = decideAutoSend({
      draft: draft(),
      now: new Date(due.getTime() - 60_000),
      currentWeekKey: "2026-11-16",
      paidAlreadySent: false,
      briefAlreadySent: false,
    });
    expect(decision).toEqual({ action: "skip", reason: "within-24h" });
  });

  it("does not send a past week, a hold, a draft with no source links, or a draft that fails the approve checks", () => {
    const base = { now: due, currentWeekKey: "2026-11-16", paidAlreadySent: false, briefAlreadySent: false };
    expect(decideAutoSend({ ...base, draft: draft({ weekKey: "2026-11-09" }) }).action).toBe("skip");
    expect(decideAutoSend({ ...base, draft: draft({ autoSendHoldAt: due }) })).toEqual({ action: "skip", reason: "held" });
    expect(decideAutoSend({ ...base, draft: draft({ sources: [] }) })).toEqual({ action: "skip", reason: "no-source-links" });
    expect(decideAutoSend({ ...base, draft: draft({ sources: [{ url: "https://film.ca.gov/", status: "error: timeout" }] }) })).toEqual({
      action: "skip",
      reason: "no-source-links",
    });
    expect(decideAutoSend({ ...base, draft: draft({ wireMarkdown: "short", status: "failed" }) })).toEqual({
      action: "skip",
      reason: "not-ready",
    });
    expect(decideAutoSend({ ...base, draft: draft({ wireMarkdown: "short" }) })).toEqual({
      action: "skip",
      reason: "failed-validation",
    });
    expect(decideAutoSend({ ...base, draft: draft({ autoSendState: AUTO_SENT_STATUS }) })).toEqual({
      action: "skip",
      reason: "already-auto-sent",
    });
  });

  it("states the Pacific deadline in the review email", () => {
    expect(draftReadyAutoSendSentence(notified)).toBe(
      "This will be sent automatically at Tuesday, November 17, 2026 at 1:00 PM PT unless you approve, edit or hold it.",
    );
  });
});
