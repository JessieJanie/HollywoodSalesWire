/**
 * Payloads for the publisher's one-click approve-and-send buttons.
 * Sending still requires the click (and the confirm dialog in the page).
 * These helpers only decide what that click would send.
 */

export interface ReadyDraft {
  weekKey?: string | null;
  wireMarkdown?: string | null;
  freeSubject?: string | null;
  freeBody?: string | null;
}

export function paidApprovePayload(draft: ReadyDraft, editedWire?: string | null): {
  subject: string;
  bodyText: string;
} | null {
  const bodyText = (editedWire ?? draft.wireMarkdown ?? "").trim();
  const weekKey = draft.weekKey?.trim();
  if (!weekKey || bodyText.length < 100) return null;
  return {
    subject: `Hollywood Sales Wire — Week of ${weekKey}`,
    bodyText,
  };
}

export function briefApprovePayload(draft: ReadyDraft): { subject: string; bodyText: string } | null {
  const subject = draft.freeSubject?.trim() ?? "";
  const bodyText = draft.freeBody?.trim() ?? "";
  if (subject.length < 3 || bodyText.length < 50) return null;
  return { subject, bodyText };
}
