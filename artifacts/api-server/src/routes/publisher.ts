import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import {
  db,
  emailSubscribersTable,
  weeklyPreviewsTable,
  membersTable,
  paidWireSendsTable,
} from "@workspace/db";
import { PublisherSendResponse } from "@workspace/api-zod";
import { resendRequest } from "../lib/resend";
import { FROM_ADDRESS, SITE_URL } from "../lib/emailSequence";
import { currentWeekKey } from "../lib/wireResearch";
import {
  INACTIVE_SUB_STATUSES,
  activeRecipients,
  planPaidSend,
  sendPaidWireBatches,
  type PaidRecipient,
} from "../lib/paidWire";

const router: IRouter = Router();

function keyOk(key: unknown): boolean {
  const expected = process.env.PUBLISHER_KEY;
  if (typeof key !== "string" || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post("/publisher/draft", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const wireText = typeof req.body?.wireText === "string" ? req.body.wireText.trim() : "";
  if (wireText.length < 100) {
    res.status(400).json({ error: "Paste the full issue text (at least a few paragraphs)." });
    return;
  }
  try {
    const { draftFreeEdition } = await import("../lib/freeEdition");
    res.json(await draftFreeEdition(wireText));
  } catch {
    res.status(502).json({ error: "Drafting failed — please try again." });
    return;
  }
});

function previewHtml(bodyText: string, unsubscribeUrl: string): string {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (s) =>
        `<p>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;">Hollywood Sales Wire — Free Edition</p>
      ${paragraphs}
      <p style="margin:28px 0;"><a href="${SITE_URL}/order?utm_source=email&amp;utm_medium=weekly-preview&amp;utm_campaign=free-edition" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Become a Member</a></p>
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you signed up at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

router.post("/publisher/send", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const bodyText = typeof req.body?.bodyText === "string" ? req.body.bodyText.trim() : "";
  if (subject.length < 3 || bodyText.length < 50) {
    res.status(400).json({ error: "Subject and body are required." });
    return;
  }

  const recipients = await db
    .select()
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.status, "active"));

  let sent = 0;
  const failures: string[] = [];
  // Resend batch endpoint accepts up to 100 emails per call.
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    try {
      await resendRequest("/emails/batch", {
        method: "POST",
        body: chunk.map((r) => ({
          from: FROM_ADDRESS,
          to: [r.email],
          subject,
          html: previewHtml(
            bodyText,
            `${SITE_URL}/api/unsubscribe?token=${r.unsubscribeToken}`,
          ),
        })),
      });
      sent += chunk.length;
    } catch (err) {
      console.error("weekly preview batch failed:", err);
      failures.push(...chunk.map((r) => r.email));
    }
  }

  if (sent === 0 && recipients.length > 0) {
    res.status(502).json({ error: "Sending failed — nothing went out. Please try again." });
    return;
  }
  await db.insert(weeklyPreviewsTable).values({ subject, bodyText, recipientCount: sent });
  const result = PublisherSendResponse.parse({ sent });
  if (failures.length > 0) {
    console.error(`weekly preview: ${failures.length} recipients failed`);
  }
  res.json(result);
});

function paidWireHtml(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(
      (s) =>
        `<p>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;">Hollywood Sales Wire — Member Edition</p>
      ${paragraphs}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; You're receiving this because you're a paying member.<br />
        Questions? Just reply to this email. Manage your membership at <a href="${SITE_URL}" style="color:#8a8577;">hollywoodsaleswire.com</a>.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Members whose Stripe subscription is in an inactive state (canceled, unpaid,
 * …) are excluded; Stripe's synced `stripe.subscriptions` table is the source
 * of truth. Members without a subscription id (one-time purchases) stay in.
 */
async function paidRecipients(): Promise<PaidRecipient[]> {
  const members = await db
    .select({
      id: membersTable.id,
      email: membersTable.email,
      stripeSubscriptionId: membersTable.stripeSubscriptionId,
    })
    .from(membersTable);
  const subIds = members.map((m) => m.stripeSubscriptionId).filter((s): s is string => !!s);
  let inactive = new Set<string>();
  if (subIds.length > 0) {
    const rows = await db.execute(
      sql`select id from stripe.subscriptions where id = any(${subIds}) and status = any(${[...INACTIVE_SUB_STATUSES]})`,
    );
    inactive = new Set((rows.rows as { id: string }[]).map((r) => r.id));
  }
  return activeRecipients(members, inactive);
}

router.post("/publisher/paid-send", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const subject = typeof req.body?.subject === "string" ? req.body.subject.trim() : "";
  const bodyText = typeof req.body?.bodyText === "string" ? req.body.bodyText.trim() : "";
  if (subject.length < 3 || bodyText.length < 100) {
    res.status(400).json({ error: "Subject and the full Wire body are required." });
    return;
  }

  // Atomic claim: the unique index on week_key makes a double-send impossible.
  // The claim freezes the eligible-recipient snapshot AND the content, and is
  // NEVER deleted on failure — a failed request may still have been accepted
  // by Resend. Retries replay the SAME snapshot in the same order with the
  // same per-batch idempotency keys, so payloads are identical and Resend
  // deduplicates, even if membership changed between attempts.
  //
  // The existing claim is checked FIRST: a retry must replay the frozen
  // snapshot unconditionally, never consult current entitlement (a snapshot
  // whose members all became inactive must still be deliverable on retry).
  const weekKey = currentWeekKey();
  const loadExisting = () =>
    db
      .select()
      .from(paidWireSendsTable)
      .where(eq(paidWireSendsTable.weekKey, weekKey))
      .then((rows) => rows[0]);

  let claim = await loadExisting();
  let plan = planPaidSend(claim, -1);
  if (plan.action !== "resume" && plan.action !== "already-sent") {
    const recipients = await paidRecipients();
    plan = planPaidSend(undefined, recipients.length);
    if (plan.action === "create") {
      const claimed = await db
        .insert(paidWireSendsTable)
        .values({
          weekKey,
          subject,
          bodyText,
          status: "sending",
          recipientEmails: recipients.map((r) => r.email),
          recipientCount: 0,
        })
        .onConflictDoNothing({ target: paidWireSendsTable.weekKey })
        .returning();
      // Lost a race with a concurrent request → fall through to the winner's claim.
      claim = claimed[0] ?? (await loadExisting());
      plan = claimed[0] ? plan : planPaidSend(claim, -1);
    }
  }
  if (plan.action === "no-recipients") {
    res.status(400).json({ error: "No active members to send to yet." });
    return;
  }
  if (plan.action === "already-sent" || !claim) {
    res.status(409).json({ error: "This week's paid Wire has already been sent to members." });
    return;
  }
  const frozenClaim = claim;

  const { sent, failedEmails } = await sendPaidWireBatches({
    claimId: frozenClaim.id,
    emails: frozenClaim.recipientEmails,
    buildEmail: (email) => ({
      from: FROM_ADDRESS,
      to: [email],
      subject: frozenClaim.subject,
      html: paidWireHtml(frozenClaim.bodyText),
    }),
    sendBatch: (emails, idempotencyKey) =>
      resendRequest("/emails/batch", {
        method: "POST",
        body: emails,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onBatchError: (err, batchIndex) =>
      req.log.error({ err, batchIndex }, "paid wire batch failed"),
  });

  if (sent === 0) {
    res.status(502).json({
      error:
        "Sending failed — the claim is kept, so pressing send again will safely resume without double-sending.",
    });
    return;
  }
  await db
    .update(paidWireSendsTable)
    .set(
      failedEmails.length === 0
        ? { status: "sent", recipientCount: sent }
        : { recipientCount: sent },
    )
    .where(eq(paidWireSendsTable.id, frozenClaim.id));
  if (failedEmails.length > 0) {
    req.log.error({ count: failedEmails.length }, "paid wire: some batches failed");
    res.status(502).json({
      error: `Only ${sent} of ${frozenClaim.recipientEmails.length} went out. Press send again to safely retry the rest — already-delivered batches will not be re-sent.`,
    });
    return;
  }
  res.json(PublisherSendResponse.parse({ sent }));
});

router.get("/publisher/status", async (req, res): Promise<void> => {
  if (!keyOk(req.query.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailSubscribersTable)
    .where(eq(emailSubscribersTable.status, "active"));
  const [last] = await db
    .select()
    .from(weeklyPreviewsTable)
    .orderBy(desc(weeklyPreviewsTable.sentAt))
    .limit(1);
  const [{ count: memberCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(membersTable);
  const [lastPaid] = await db
    .select()
    .from(paidWireSendsTable)
    .orderBy(desc(paidWireSendsTable.sentAt))
    .limit(1);
  res.json({
    subscriberCount: count,
    memberCount,
    paidSentThisWeek: lastPaid?.weekKey === currentWeekKey() && lastPaid.status === "sent",
    ...(last ? { lastSentAt: last.sentAt.toISOString(), lastSubject: last.subject } : {}),
    ...(lastPaid
      ? { lastPaidSentAt: lastPaid.sentAt.toISOString(), lastPaidSubject: lastPaid.subject }
      : {}),
  });
});

export default router;
