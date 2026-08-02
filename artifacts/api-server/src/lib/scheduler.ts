import { and, eq, lte, or } from "drizzle-orm";
import { db, wireRunsTable, emailSubscribersTable, sequenceEmailsTable } from "@workspace/db";
import { runWeeklyResearch, currentWeekKey } from "./wireResearch";
import { FROM_ADDRESS, SEQUENCE, SITE_URL } from "./emailSequence";
import { deadlineLabel } from "./foundingDeadline";
import { resendRequest } from "./resend";
import { logger } from "./logger";

/**
 * Monday 5:30 PM Pacific auto-run, with catch-up: if the server was asleep
 * (autoscale) at 5:30 PM, the run fires on the next tick after the due moment —
 * including when Karilyn opens her console Monday evening or Tuesday morning.
 */
function isDue(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const dow = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  if (dow === "Mon") return hour > 17 || (hour === 17 && minute >= 30);
  // Catch-up window through Wednesday; after that the week is stale.
  return dow === "Tue" || dow === "Wed";
}

/**
 * Founding-series steps beyond Resend's ~30-day scheduling window are stored
 * as "pending" rows; this hands each one to Resend once its send time is
 * within range. Atomic claim (UPDATE … WHERE status='pending' RETURNING)
 * keeps concurrent autoscale instances from double-scheduling; the claim is
 * released on failure so the next tick retries.
 */
const RESEND_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const CLAIM_LEASE_MS = 15 * 60 * 1000;

async function tickPendingEmails(): Promise<void> {
  const now = Date.now();
  const windowEnd = new Date(now + RESEND_WINDOW_MS);
  const staleClaim = new Date(now - CLAIM_LEASE_MS);
  const due = await db
    .select({ item: sequenceEmailsTable })
    .from(sequenceEmailsTable)
    .where(
      and(
        lte(sequenceEmailsTable.scheduledAt, windowEnd),
        or(
          eq(sequenceEmailsTable.status, "pending"),
          // Recover rows stranded by a crash mid-handoff (lease expired).
          and(
            eq(sequenceEmailsTable.status, "scheduling"),
            lte(sequenceEmailsTable.claimedAt, staleClaim),
          ),
        ),
      ),
    );

  for (const { item } of due) {
    const stepDef = SEQUENCE.find((s) => s.step === item.step);
    if (!stepDef) continue;

    // Claim the row atomically before touching Resend (fresh pending claim or
    // takeover of an expired lease).
    const claimed = await db
      .update(sequenceEmailsTable)
      .set({ status: "scheduling", claimedAt: new Date() })
      .where(
        and(
          eq(sequenceEmailsTable.id, item.id),
          or(
            eq(sequenceEmailsTable.status, "pending"),
            and(
              eq(sequenceEmailsTable.status, "scheduling"),
              lte(sequenceEmailsTable.claimedAt, staleClaim),
            ),
          ),
        ),
      )
      .returning({ id: sequenceEmailsTable.id });
    if (claimed.length === 0) continue;

    // Re-read the subscriber AFTER claiming so an unsubscribe or purchase
    // that happened moments ago is respected.
    const [subscriber] = await db
      .select()
      .from(emailSubscribersTable)
      .where(eq(emailSubscribersTable.id, item.subscriberId));
    if (!subscriber || subscriber.status !== "active") {
      await db
        .update(sequenceEmailsTable)
        .set({ status: "canceled" })
        .where(eq(sequenceEmailsTable.id, item.id));
      continue;
    }

    try {
      const token = subscriber.unsubscribeToken;
      const sent = await resendRequest<{ id: string }>("/emails", {
        method: "POST",
        body: {
          from: FROM_ADDRESS,
          to: [subscriber.email],
          subject: stepDef.subject,
          html: stepDef.body({
            unsubscribeUrl: `${SITE_URL}/api/unsubscribe?token=${token}`,
            offerUrl: `${SITE_URL}/founding-offer?token=${token}`,
            deadlineLabel: deadlineLabel(subscriber.createdAt),
          }),
          scheduled_at: item.scheduledAt.toISOString(),
        },
      });
      // Confirm the row wasn't canceled while the Resend call was in flight
      // (unsubscribe/purchase paths cancel 'scheduling' rows directly). If it
      // was, cancel the email we just created at Resend.
      const confirmed = await db
        .update(sequenceEmailsTable)
        .set({ status: "scheduled", resendEmailId: sent.id, claimedAt: null })
        .where(and(eq(sequenceEmailsTable.id, item.id), eq(sequenceEmailsTable.status, "scheduling")))
        .returning({ id: sequenceEmailsTable.id });
      if (confirmed.length === 0) {
        logger.info({ id: item.id }, "scheduler: row canceled mid-handoff — canceling Resend email");
        try {
          await resendRequest(`/emails/${sent.id}/cancel`, { method: "POST" });
        } catch (cancelErr) {
          logger.error({ err: cancelErr, resendEmailId: sent.id }, "scheduler: failed to cancel in-flight email");
        }
        continue;
      }
      logger.info(
        { email: subscriber.email, step: item.step },
        "scheduler: pending sequence email handed to Resend",
      );
    } catch (err) {
      logger.error({ err, id: item.id }, "scheduler: failed to schedule pending email — will retry");
      await db
        .update(sequenceEmailsTable)
        .set({ status: "pending", claimedAt: null })
        .where(and(eq(sequenceEmailsTable.id, item.id), eq(sequenceEmailsTable.status, "scheduling")))
        .catch((revertErr) =>
          logger.error({ err: revertErr, id: item.id }, "scheduler: failed to release claim"),
        );
    }
  }
}

async function tick(): Promise<void> {
  try {
    await tickPendingEmails();
  } catch (err) {
    logger.error({ err }, "pending-email tick failed");
  }
  try {
    if (!isDue()) return;
    const weekKey = currentWeekKey();
    // Any row for this week — including a failed one — stops the auto-scheduler.
    // A failed run notifies Karilyn and is retried only by her "Run now" button,
    // so a persistent failure can never turn into a paid retry loop.
    const existing = await db
      .select({ id: wireRunsTable.id })
      .from(wireRunsTable)
      .where(eq(wireRunsTable.weekKey, weekKey))
      .limit(1);
    if (existing.length > 0) return;
    logger.info({ weekKey }, "scheduler: weekly research is due — starting");
    await runWeeklyResearch("schedule");
  } catch (err) {
    logger.error({ err }, "scheduler tick failed");
  }
}

export function startScheduler(): void {
  // Check on boot (autoscale wake-ups count) and every 5 minutes after.
  void tick();
  setInterval(() => void tick(), 5 * 60 * 1000).unref();
}
