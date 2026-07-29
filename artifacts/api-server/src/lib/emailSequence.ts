/**
 * The 5-email "free preview briefing" opt-in series.
 *
 * DRAFT COPY — the publisher (Karilyn) supplies final copy; replace the
 * subject/body text below verbatim with hers when provided. Structure
 * (steps, day offsets, unsubscribe footer) should stay.
 *
 * Day offsets are in days after signup: 1, 2, 3, 6, 7.
 */

export const FROM_ADDRESS = "Hollywood Sales Wire <briefings@hollywoodsaleswires.com>";
export const SITE_URL = process.env.SITE_URL ?? "https://hollywoodsaleswire.com";

export interface SequenceStep {
  step: number;
  dayOffset: number;
  subject: string;
  body: (opts: { unsubscribeUrl: string }) => string;
}

function wrap(content: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you requested the free preview briefing at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

const cta = `<p style="margin:28px 0;"><a href="${SITE_URL}/order" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Become a Member</a></p>`;

export const SEQUENCE: SequenceStep[] = [
  {
    step: 1,
    dayOffset: 1,
    subject: "[DRAFT] Your free preview briefing",
    body: ({ unsubscribeUrl }) =>
      wrap(
        `<p>Thanks for requesting the preview. Here's a taste of what Hollywood Sales Wire members get every week: who's staffing up, who's greenlit, and who's buying — before the trades catch on.</p>${cta}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 2,
    dayOffset: 2,
    subject: "[DRAFT] Why bought lead lists are already dead",
    body: ({ unsubscribeUrl }) =>
      wrap(
        `<p>The lead list your competitors bought is already stale. Production intelligence moves weekly — your prospecting should too.</p>${cta}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 3,
    dayOffset: 3,
    subject: "[DRAFT] How members use the Wire",
    body: ({ unsubscribeUrl }) =>
      wrap(
        `<p>Members use the briefing to reach decision-makers the week budgets open — not months later. Here's how a typical week looks.</p>${cta}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 4,
    dayOffset: 6,
    subject: "[DRAFT] What this week's briefing covered",
    body: ({ unsubscribeUrl }) =>
      wrap(
        `<p>A quick look at the kind of intelligence that went out to members this week — and what it would have meant for your pipeline.</p>${cta}`,
        unsubscribeUrl,
      ),
  },
  {
    step: 5,
    dayOffset: 7,
    subject: "[DRAFT] Founding membership — last note",
    body: ({ unsubscribeUrl }) =>
      wrap(
        `<p>This is the last note in this series. Founding member pricing is live now — lock it in before it goes.</p>${cta}`,
        unsubscribeUrl,
      ),
  },
];
