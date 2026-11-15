/**
 * Shared send logic for the two weekly emails, callable from both the
 * publisher console routes and the scheduler's scheduled-send tick:
 *
 *  - the paid HSW Weekly Wire (members), and
 *  - the free HSW Weekly Brief (warm-prospect list; formerly "Free Edition").
 *
 * The paid path keeps the atomic week-key claim in paid_wire_sends, frozen
 * recipient snapshots, and per-batch Resend idempotency keys — a double-send
 * stays impossible no matter which caller triggers it.
 */
import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  emailSubscribersTable,
  membersTable,
  paidWireSendsTable,
  productionsTable,
  subscriberPreferencesTable,
  weeklyPreviewsTable,
} from "@workspace/db";
import { resendRequest } from "./resend";
import { FROM_ADDRESS, SITE_URL } from "./emailSequence";
import { currentWeekKey } from "./wireResearch";
import {
  membershipMismatchDigest,
  planPaidSend,
  reconcileMembers,
  sendPaidWireBatches,
  type PaidRecipient,
  type StripeSubscriptionSnapshot,
} from "./paidWire";
import { shelfUrl } from "../routes/reports";
import { logger } from "./logger";
import { normalizeWireDateline } from "./wireDateline";
import { briefAlreadyArchived } from "./briefArchive";
import { yourTerritory, type StoredProduction } from "./greenlightBoard";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Plain text → paragraphs. Single newlines inside a paragraph become <br />
 * so registry tables and multi-line lists keep their line structure.
 */
function paragraphsHtml(bodyText: string): string {
  return bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => `<p style="margin:0 0 20px;">${escapeHtml(s).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

const ORDER_URL = `${SITE_URL}/order?utm_source=email&utm_medium=weekly-brief&utm_campaign=weekly-brief`;

/** "What is HSW" block shown at the end of both weekly emails. */
function aboutHtml(): string {
  return `<p style="font-size:14px;color:#5a564c;">
        <strong>What is Hollywood Sales Wire?</strong><br />
        Hollywood Sales Wire is a weekly sales-intelligence briefing for the vendors, service providers, and dealmakers who sell to the entertainment industry. Each issue turns public signals — production spending, brand-new production entities on government registries, and studio hiring — into specific opportunities, with the names and contact paths included.<br />
        Publisher: Karilyn Colegrove &middot; <a href="${SITE_URL}" style="color:#5a564c;">hollywoodsaleswire.com</a>
      </p>`;
}

/** HSW Weekly Brief (free list) email HTML. Lines starting with "→ " become a live link to the order page. */
export function briefHtml(bodyText: string, unsubscribeUrl: string): string {
  const paragraphs = bodyText
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      /^→\s*/.test(s)
        ? `<p style="margin:28px 0;"><a href="${ORDER_URL}" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">${escapeHtml(s.replace(/^→\s*/, ""))} &rarr;</a></p>`
        : `<p style="margin:0 0 20px;">${escapeHtml(s).replace(/\n/g, "<br />")}</p>`,
    )
    .join("\n");
  const hasCta = /(^|\n)→\s*/.test(bodyText);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;">HSW Weekly Brief</p>
      ${paragraphs}
      ${hasCta ? "" : `<p style="margin:28px 0;"><a href="${ORDER_URL}" style="background:#1d5c3a;color:#ffffff;padding:12px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;">Become a Founding Member</a></p>`}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      ${aboutHtml()}
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        You're receiving this because you signed up at hollywoodsaleswire.com.<br />
        <a href="${unsubscribeUrl}" style="color:#8a8577;">Unsubscribe</a> at any time.
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Paid HSW Weekly Wire email HTML: a short cover note from the publisher (with
 * the member's own signed Shelf link), then the full Wire, then the About block.
 */
export function paidWireHtml(bodyText: string, memberShelfUrl: string, territory?: string | null): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;">HSW Weekly Wire — Member Edition</p>
      <p style="margin:0 0 20px;">Good morning — here's your HSW Weekly Wire.</p>
      <p style="margin:0 0 20px;">This issue has also been placed in your <a href="${memberShelfUrl}" style="color:#1d5c3a;">HSW Shelf</a> on the website, where every issue and Special Report of yours is kept.</p>
      <p style="margin:0 0 20px;">— Karilyn</p>
      <hr style="border:none;border-top:1px solid #e5e2da;margin:24px 0;" />
      ${paragraphsHtml(bodyText)}
      ${territory ? `<hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />${paragraphsHtml(territory)}` : ""}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      ${aboutHtml()}
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        You're receiving this because you're a paying member.<br />
        Questions? Just reply to this email. Manage your membership at <a href="${SITE_URL}" style="color:#8a8577;">hollywoodsaleswire.com</a>.
      </p>
    </div>
  </body>
</html>`;
}

export interface BriefSendResult {
  sent: number;
  recipientCount: number;
  failedCount: number;
}

/**
 * Send the HSW Weekly Brief to every active free-list subscriber and record it.
 * When idempotencyPrefix is set (scheduled sends), each batch carries a stable
 * Resend Idempotency-Key so a retry of the same scheduled row cannot deliver a
 * batch twice (as long as the subscriber list is unchanged between attempts).
 */
export async function executeBriefSend(
  subject: string,
  bodyText: string,
  idempotencyPrefix?: string,
  origin: "publisher" | "auto_sent_after_24h" = "publisher",
): Promise<BriefSendResult> {
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
          html: briefHtml(bodyText, `${SITE_URL}/api/unsubscribe?token=${r.unsubscribeToken}`),
        })),
        ...(idempotencyPrefix
          ? { headers: { "Idempotency-Key": `${idempotencyPrefix}-batch-${i / 100}` } }
          : {}),
      });
      sent += chunk.length;
    } catch (err) {
      logger.error({ err }, "weekly brief batch failed");
      failures.push(...chunk.map((r) => r.email));
    }
  }

  if (sent > 0) {
    const recent = await db
      .select({ subject: weeklyPreviewsTable.subject, sentAt: weeklyPreviewsTable.sentAt })
      .from(weeklyPreviewsTable)
      .orderBy(desc(weeklyPreviewsTable.sentAt))
      .limit(40);
    if (!briefAlreadyArchived(recent, subject, new Date())) {
      await db.insert(weeklyPreviewsTable).values({ subject, bodyText, recipientCount: sent, origin });
    }
  }
  if (failures.length > 0) {
    logger.error({ count: failures.length }, "weekly brief: some recipients failed");
  }
  return { sent, recipientCount: recipients.length, failedCount: failures.length };
}

/**
 * A member is active only when Stripe's synced subscription row says so.
 * No subscription id is not active. Mismatches are logged and, in
 * production, emailed once per distinct digest so a restarted process can
 * report a new disagreement without mailing the same list on every tick.
 */
let lastMismatchDigest: string | null = null;

export async function paidRecipients(): Promise<PaidRecipient[]> {
  const members = await db
    .select({
      id: membersTable.id,
      email: membersTable.email,
      stripeSubscriptionId: membersTable.stripeSubscriptionId,
      stripeCustomerId: membersTable.stripeCustomerId,
    })
    .from(membersTable);
  const rows = await db.execute(
    sql`select id, status, customer from stripe.subscriptions`,
  );
  const subscriptions: StripeSubscriptionSnapshot[] = (rows.rows as { id: string; status: string; customer: string | null }[]).map(
    (row) => ({
      id: row.id,
      status: row.status,
      customerId: row.customer,
    }),
  );
  const { recipients, mismatches } = reconcileMembers(members, subscriptions);
  const digest = membershipMismatchDigest(mismatches);
  if (digest && digest !== lastMismatchDigest) {
    lastMismatchDigest = digest;
    logger.error({ count: mismatches.length }, "membership: Stripe status does not match the member rows");
    if (process.env.REPLIT_DEPLOYMENT === "1") {
      try {
        await resendRequest("/emails", {
          method: "POST",
          body: {
            from: FROM_ADDRESS,
            to: ["hello@hollywoodsaleswire.com"],
            subject: "Membership list does not match Stripe",
            text: `Karilyn,\n\nThese member rows disagree with the synced Stripe subscriptions. None of them were treated as active for the Tuesday issue.\n\n${digest}\n\n— Hollywood Sales Wire`,
          },
        });
      } catch (err) {
        lastMismatchDigest = null;
        logger.error({ err }, "membership: mismatch alert failed");
      }
    }
  }
  return recipients;
}

export type PaidSendResult =
  | { ok: true; sent: number }
  | { ok: false; code: "no-recipients" | "already-sent" | "send-failed" | "partial"; sent: number; error: string };

/**
 * Send the paid Wire to members for the current week. Atomic claim on
 * paid_wire_sends.week_key; retries resume the frozen snapshot with the same
 * idempotency keys, so calling this again after a failure is always safe.
 */
export async function executePaidSend(
  subject: string,
  bodyText: string,
  weekKeyOverride?: string,
  completionStatus: "sent" | "auto_sent_after_24h" = "sent",
): Promise<PaidSendResult> {
  const weekKey = weekKeyOverride ?? currentWeekKey();
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
          // Normalize only NEW claims. Never change a retry's frozen payload:
          // Resend idempotency requires identical content for the same key.
          bodyText: normalizeWireDateline(bodyText, weekKey),
          status: "sending",
          recipientEmails: recipients.map((r) => r.email),
          recipientCount: 0,
          territoryByEmail: await territoriesFor(recipients.map((r) => r.email)),
        })
        .onConflictDoNothing({ target: paidWireSendsTable.weekKey })
        .returning();
      // Lost a race with a concurrent request → fall through to the winner's claim.
      claim = claimed[0] ?? (await loadExisting());
      plan = claimed[0] ? plan : planPaidSend(claim, -1);
    }
  }
  if (plan.action === "no-recipients") {
    return { ok: false, code: "no-recipients", sent: 0, error: "No active members to send to yet." };
  }
  if (plan.action === "already-sent" || !claim) {
    return {
      ok: false,
      code: "already-sent",
      sent: 0,
      error: "This week's paid Wire has already been sent to members.",
    };
  }
  const frozenClaim = claim;

  const { sent, failedEmails } = await sendPaidWireBatches({
    claimId: frozenClaim.id,
    emails: frozenClaim.recipientEmails,
    buildEmail: (email) => ({
      from: FROM_ADDRESS,
      to: [email],
      subject: frozenClaim.subject,
      html: paidWireHtml(
        frozenClaim.bodyText,
        shelfUrl(email, SITE_URL),
        frozenTerritory(frozenClaim.territoryByEmail, email),
      ),
    }),
    sendBatch: (emails, idempotencyKey) =>
      resendRequest("/emails/batch", {
        method: "POST",
        body: emails,
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    onBatchError: (err, batchIndex) => logger.error({ err, batchIndex }, "paid wire batch failed"),
  });

  if (sent === 0) {
    return {
      ok: false,
      code: "send-failed",
      sent: 0,
      error:
        "Sending failed — the claim is kept, so trying again will safely resume without double-sending.",
    };
  }
  await db
    .update(paidWireSendsTable)
    .set(
      failedEmails.length === 0
        ? { status: completionStatus, recipientCount: sent }
        : { recipientCount: sent },
    )
    .where(eq(paidWireSendsTable.id, frozenClaim.id));
  if (failedEmails.length > 0) {
    return {
      ok: false,
      code: "partial",
      sent,
      error: `Only ${sent} of ${frozenClaim.recipientEmails.length} went out. Sending again safely retries the rest — already-delivered batches will not be re-sent.`,
    };
  }
  return { ok: true, sent };
}

function frozenTerritory(value: unknown, email: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const text = (value as Record<string, unknown>)[email];
  return typeof text === "string" && text.length > 0 ? text : null;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Frozen onto the weekly claim so a retry cannot change the personalization. */
async function territoriesFor(emails: string[]): Promise<Record<string, string>> {
  try {
    const prefs = await db.select().from(subscriberPreferencesTable);
    const rows = await db.select().from(productionsTable);
    const productions = rows.flatMap((row) => {
      if (!row || typeof row !== "object" || !("titleKey" in row)) return [];
      return [row as unknown as StoredProduction];
    });
    const out: Record<string, string> = {};
    for (const pref of prefs) {
      if (!pref || typeof pref !== "object" || !("email" in pref)) continue;
      const email = String((pref as { email?: unknown }).email ?? "");
      if (!emails.includes(email)) continue;
      const record = pref as {
        states?: unknown;
        projectTypes?: unknown;
        budgetBands?: unknown;
        vendorCategories?: unknown;
      };
      out[email] = yourTerritory(
        {
          states: asStringList(record.states),
          projectTypes: asStringList(record.projectTypes),
          budgetBands: asStringList(record.budgetBands),
          vendorCategories: asStringList(record.vendorCategories),
        },
        productions,
      );
    }
    return out;
  } catch (err) {
    logger.error({ err }, "territory section skipped for this claim");
    return {};
  }
}
