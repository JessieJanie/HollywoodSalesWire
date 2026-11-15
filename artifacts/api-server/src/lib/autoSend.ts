import { paidApprovePayload, briefApprovePayload } from "../../../hollywood-sales-wire/src/lib/approveSend.ts";

export const AUTO_SEND_AFTER_MS = 24 * 60 * 60 * 1000;
export const AUTO_SENT_STATUS = "auto_sent_after_24h";

export interface AutoSendSource {
  url?: unknown;
  status?: unknown;
}

export interface AutoSendDraft {
  weekKey: string;
  status: string;
  wireMarkdown: string | null;
  freeSubject: string | null;
  freeBody: string | null;
  sources: unknown;
  draftReadyNotifiedAt: Date | null;
  autoSendHoldAt: Date | null;
  autoSendState: string | null;
}

export type AutoSendDecision =
  | { action: "skip"; reason: string }
  | {
      action: "send";
      paid: { subject: string; bodyText: string } | null;
      brief: { subject: string; bodyText: string } | null;
    };

export function hasPublishableSourceLinks(sources: unknown): boolean {
  if (!Array.isArray(sources) || sources.length === 0) return false;
  return sources.some((source) => {
    if (!source || typeof source !== "object") return false;
    const row = source as AutoSendSource;
    return typeof row.url === "string"
      && row.url.startsWith("https://")
      && !(typeof row.status === "string" && row.status.startsWith("error"));
  });
}

export function formatPacificClock(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const minute = value("minute");
  const dayPeriod = value("dayPeriod");
  return `${value("weekday")}, ${value("month")} ${value("day")}, ${value("year")} at ${value("hour")}:${minute} ${dayPeriod} PT`;
}

export function autoSendDeadline(notifiedAt: Date): Date {
  return new Date(notifiedAt.getTime() + AUTO_SEND_AFTER_MS);
}

export function draftReadyAutoSendSentence(notifiedAt: Date): string {
  return `This will be sent automatically at ${formatPacificClock(autoSendDeadline(notifiedAt))} unless you approve, edit or hold it.`;
}

/**
 * Auto-send only the current week's ready draft, 24 hours after the review
 * email, and only when the draft has source links and passes the same
 * approve-and-send checks. A hold, a past week, or a failed draft does not send.
 */
export function decideAutoSend(input: {
  draft: AutoSendDraft;
  now: Date;
  currentWeekKey: string;
  paidAlreadySent: boolean;
  briefAlreadySent: boolean;
}): AutoSendDecision {
  const { draft, now } = input;
  if (draft.weekKey !== input.currentWeekKey) return { action: "skip", reason: "past-week" };
  if (draft.status !== "ready") return { action: "skip", reason: "not-ready" };
  if (draft.autoSendHoldAt) return { action: "skip", reason: "held" };
  if (draft.autoSendState === AUTO_SENT_STATUS) return { action: "skip", reason: "already-auto-sent" };
  if (!draft.draftReadyNotifiedAt) return { action: "skip", reason: "not-notified" };
  if (now.getTime() < draft.draftReadyNotifiedAt.getTime() + AUTO_SEND_AFTER_MS) {
    return { action: "skip", reason: "within-24h" };
  }
  if (!hasPublishableSourceLinks(draft.sources)) return { action: "skip", reason: "no-source-links" };
  const paid = input.paidAlreadySent ? null : paidApprovePayload(draft);
  const brief = input.briefAlreadySent ? null : briefApprovePayload(draft);
  if (!input.paidAlreadySent && !paid) return { action: "skip", reason: "failed-validation" };
  if (!input.briefAlreadySent && !brief) return { action: "skip", reason: "failed-validation" };
  if (!paid && !brief) return { action: "skip", reason: "already-sent" };
  return { action: "send", paid, brief };
}
