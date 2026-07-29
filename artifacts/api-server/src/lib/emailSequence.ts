/**
 * Signup email for the warm-prospect list.
 *
 * Per the publisher (July 2026): signups get ONE immediate welcome email and
 * are added to the warm prospect list. No automated drip series — date-specific
 * campaigns are run manually later (copy lives in marketing/
 * founding-offer-email-series-draft5.txt).
 */

export const FROM_ADDRESS = "Hollywood Sales Wire <briefings@hollywoodsaleswires.com>";
export const SITE_URL = process.env.SITE_URL ?? "https://hollywoodsaleswire.com";

function wrap(content: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      ${content}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you signed up at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

export const WELCOME_EMAIL = {
  subject: "You're on the list — Hollywood Sales Wire",
  body: ({ unsubscribeUrl }: { unsubscribeUrl: string }) =>
    wrap(
      `<p>Hello Reader,</p>
<p>You're on the Hollywood Sales Wire list. You'll hear from us with intelligence briefings and occasional offers — and nothing else. We never rent or share this list.</p>
<p>In the meantime, you can learn more about the Wire and membership here:</p>
<p style="margin:28px 0;"><a href="${SITE_URL}" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Visit Hollywood Sales Wire</a></p>
<p>Karilyn Colegrove, Publisher<br />Hollywood Sales Wire</p>`,
      unsubscribeUrl,
    ),
};
