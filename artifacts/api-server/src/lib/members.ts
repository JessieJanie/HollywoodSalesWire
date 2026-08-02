import { eq, and, isNull, sql } from "drizzle-orm";
import {
  db,
  membersTable,
  emailSubscribersTable,
  sequenceEmailsTable,
} from "@workspace/db";
import { resendRequest } from "./resend";
import { FROM_ADDRESS, SITE_URL } from "./emailSequence";
import { logger } from "./logger";

const NOTIFY_EMAIL = "hello@hollywoodsaleswire.com";

/**
 * Map the checkout total to a plan label (payment-link amounts, in cents).
 * Label-only: discounts/tax on a future link would fall back to "member",
 * which affects nothing except the wording in the notification email.
 */
function planFromAmount(amountCents: number | null | undefined): string {
  switch (amountCents) {
    case 199500:
      return "founding-individual";
    case 499500:
      return "founding-team";
    case 399500:
      return "individual";
    case 999500:
      return "team";
    default:
      return "member";
  }
}

function planLabel(plan: string): string {
  switch (plan) {
    case "founding-individual":
      return "Founding Member — Individual ($1,995/yr)";
    case "founding-team":
      return "Founding Member — Team ($4,995/yr)";
    case "individual":
      return "Member — Individual ($3,995/yr)";
    case "team":
      return "Member — Team ($9,995/yr)";
    default:
      return "Member";
  }
}

/**
 * NEW-MEMBER WELCOME EMAIL — transactional copy, flagged for the publisher's
 * review (publisher-locked policy). Deliberately plain and claim-free.
 */
function welcomeHtml(): string {
  const p = (s: string) => `<p>${s}</p>`;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      ${p("Welcome — your membership is active.")}
      ${p("Thank you for joining Hollywood Sales Wire. Your subscription is confirmed, and your first issue of the Wire arrives Tuesday morning.")}
      ${p("If you joined as a Founding Member, your three Special Reports are on their way separately.")}
      ${p("Reply to this email any time — it reaches me directly.")}
      ${p("Karilyn Colegrove, Publisher<br />Hollywood Sales Wire")}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; <a href="${SITE_URL}" style="color:#8a8577;">hollywoodsaleswire.com</a><br />
        This is a receipt-of-membership email for your paid subscription.
      </p>
    </div>
  </body>
</html>`;
}

interface CheckoutSessionLike {
  id?: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
}

/**
 * Called for every verified Stripe webhook event (after stripe-replit-sync
 * has synced it). Records the member, stops the founding-offer sales series,
 * sends a one-time welcome email, and notifies the publisher.
 *
 * Retry/concurrency safety (Stripe retries + multiple autoscale instances):
 * - The member upsert is a single atomic INSERT … ON CONFLICT.
 * - Welcome + publisher notification are gated by an atomic claim on
 *   `welcome_sent_at` (UPDATE … WHERE welcome_sent_at IS NULL RETURNING), so
 *   exactly one delivery wins; the claim is released if sending fails so a
 *   later Stripe retry can try again.
 * - Throws on member-persistence failure so the route returns 500 and Stripe
 *   retries; email side-effect failures never throw.
 */
export async function handleStripeEvent(event: {
  type?: string;
  data?: { object?: unknown };
}): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  const session = (event.data?.object ?? {}) as CheckoutSessionLike;
  if (session.payment_status && session.payment_status !== "paid") return;

  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) {
    logger.warn({ sessionId: session.id }, "stripe: checkout completed without an email");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const amountCents = session.amount_total ?? null;
  const plan = planFromAmount(amountCents);

  // Atomic upsert — if this throws, the caller returns 500 and Stripe retries.
  await db
    .insert(membersTable)
    .values({ email, stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId, plan, amountCents })
    .onConflictDoUpdate({
      target: membersTable.email,
      set: {
        stripeCustomerId: sql`coalesce(excluded.stripe_customer_id, ${membersTable.stripeCustomerId})`,
        stripeSubscriptionId: sql`coalesce(excluded.stripe_subscription_id, ${membersTable.stripeSubscriptionId})`,
        plan: sql`excluded.plan`,
        amountCents: sql`excluded.amount_cents`,
      },
    });

  logger.info({ email, plan }, "stripe: paid member recorded");

  // Atomically claim the one-time welcome/notification. Zero rows = another
  // delivery already claimed it (or it was already sent) — stop here.
  const claimed = await db
    .update(membersTable)
    .set({ welcomeSentAt: new Date() })
    .where(and(eq(membersTable.email, email), isNull(membersTable.welcomeSentAt)))
    .returning({ id: membersTable.id });
  if (claimed.length === 0) return;

  // Stop the founding-offer sales series — they already bought. Mark canceled
  // only when Resend confirms; a failed cancel stays "scheduled" in our books.
  try {
    const [subscriber] = await db
      .select()
      .from(emailSubscribersTable)
      .where(eq(emailSubscribersTable.email, email));
    if (subscriber) {
      const scheduled = await db
        .select()
        .from(sequenceEmailsTable)
        .where(eq(sequenceEmailsTable.subscriberId, subscriber.id));
      for (const item of scheduled) {
        if (item.status === "pending" || item.status === "scheduling") {
          // Not yet (fully) handed to Resend. Marking it canceled here also
          // signals an in-flight scheduler handoff to cancel its Resend email.
          await db
            .update(sequenceEmailsTable)
            .set({ status: "canceled" })
            .where(eq(sequenceEmailsTable.id, item.id));
          continue;
        }
        if (item.status === "scheduled" && item.resendEmailId) {
          try {
            await resendRequest(`/emails/${item.resendEmailId}/cancel`, { method: "POST" });
            await db
              .update(sequenceEmailsTable)
              .set({ status: "canceled" })
              .where(eq(sequenceEmailsTable.id, item.id));
          } catch (err) {
            logger.warn({ err, id: item.id }, "stripe: could not cancel scheduled sales email");
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, email }, "stripe: failed while canceling founding series");
  }

  // Welcome email. If it fails, release the claim so a Stripe retry resends.
  try {
    await resendRequest("/emails", {
      method: "POST",
      body: {
        from: FROM_ADDRESS,
        to: [email],
        subject: "Welcome to Hollywood Sales Wire — your membership is active",
        html: welcomeHtml(),
      },
    });
  } catch (err) {
    logger.error({ err, email }, "stripe: failed to send member welcome email — releasing claim");
    try {
      await db
        .update(membersTable)
        .set({ welcomeSentAt: null })
        .where(eq(membersTable.email, email));
    } catch (releaseErr) {
      logger.error({ err: releaseErr, email }, "stripe: failed to release welcome claim");
    }
    return;
  }

  // Publisher notification — first successful claim only.
  try {
    await resendRequest("/emails", {
      method: "POST",
      body: {
        from: FROM_ADDRESS,
        to: [NOTIFY_EMAIL],
        subject: `New paid member: ${email}`,
        html: `<p>A new member just subscribed via Stripe.</p><ul><li><strong>Email:</strong> ${email}</li><li><strong>Plan:</strong> ${planLabel(plan)}</li></ul><p>Their welcome email was sent automatically, and any pending founding-offer sales emails to them were canceled. If they're a Founding Member, remember to send their three Special Reports.</p>`,
      },
    });
  } catch (err) {
    logger.error({ err, email }, "stripe: failed to send publisher notification");
  }
}
