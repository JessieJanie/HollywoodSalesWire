import { and, eq, lte, or } from "drizzle-orm";
import {
  db,
  wireRunsTable,
  emailSubscribersTable,
  sequenceEmailsTable,
  scheduledSendsTable,
  socialDraftsTable,
} from "@workspace/db";
import { pushHighlightToTypefully } from "./typefully";
import { claimSocialDraft } from "./socialDrafts";
import { executeBriefSend, executePaidSend } from "./sendWire";
import { SCHEDULED_SEND_SEEDS } from "./scheduledSeeds";
import { deliverReportsToPendingMembers, resetStaleReportLeases } from "./members";
import { runWeeklyResearch, currentWeekKey } from "./wireResearch";
import { FROM_ADDRESS, SEQUENCE, SITE_URL } from "./emailSequence";
import { deadlineLabel } from "./foundingDeadline";
import { resendRequest } from "./resend";
import { createColdBatch } from "./coldCampaigns";
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

/**
 * Recover stale report-delivery leases and retry any undelivered founding
 * members. Runs every scheduler tick (5 min) alongside pending-email
 * processing, so a failed delivery from the checkout webhook or the upload-
 * confirm path is automatically retried without publisher intervention.
 */
async function tickReportDeliveries(): Promise<void> {
  // Reset leases older than 15 minutes whose delivery was never confirmed.
  await resetStaleReportLeases();
  // Deliver to any founding members still waiting (new or stale-lease-reset).
  await deliverReportsToPendingMembers();
}

/**
 * One-shot scheduled sends (paid Wire / Weekly Brief at a publisher-chosen
 * time). Seeds are inserted in production only — dev servers must never mail
 * the real lists — and the unique (kind, week_key) index makes seeding
 * idempotent across autoscale instances. Rows are claimed atomically
 * (pending → sending) with a stale-lease takeover, and the paid path is
 * additionally guarded by the paid_wire_sends week-key claim, so even a
 * botched lease can never double-send members.
 */
const SCHEDULED_SEND_LEASE_MS = 15 * 60 * 1000;

async function tickScheduledSends(): Promise<void> {
  // Production only — a dev server must never mail the real lists, and dev
  // has no business processing scheduled rows at all.
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;

  // Seed this week's publisher-approved sends (idempotent via unique index).
  for (const seed of SCHEDULED_SEND_SEEDS) {
    await db
      .insert(scheduledSendsTable)
      .values({
        kind: seed.kind,
        weekKey: seed.weekKey,
        sendAt: new Date(seed.sendAtIso),
        subject: seed.subject,
        bodyText: seed.bodyText,
      })
      .onConflictDoNothing({
        target: [scheduledSendsTable.kind, scheduledSendsTable.weekKey],
      });
  }

  const now = new Date();
  const staleClaim = new Date(now.getTime() - SCHEDULED_SEND_LEASE_MS);
  const due = await db
    .select()
    .from(scheduledSendsTable)
    .where(
      and(
        lte(scheduledSendsTable.sendAt, now),
        or(
          eq(scheduledSendsTable.status, "pending"),
          and(
            eq(scheduledSendsTable.status, "sending"),
            lte(scheduledSendsTable.claimedAt, staleClaim),
          ),
        ),
      ),
    );

  for (const row of due) {
    // Stale-week guard: if the server first wakes after the row's week has
    // passed, the copy is out of date — never send it, and never let it claim
    // a newer week's paid slot.
    if (row.weekKey !== currentWeekKey()) {
      await db
        .update(scheduledSendsTable)
        .set({ status: "failed", claimedAt: null, error: "Week passed before the send could run — not sent." })
        .where(and(eq(scheduledSendsTable.id, row.id), or(eq(scheduledSendsTable.status, "pending"), eq(scheduledSendsTable.status, "sending"))));
      logger.error({ id: row.id, weekKey: row.weekKey }, "scheduler: scheduled send expired unsent");
      continue;
    }

    // Atomic claim; completion updates below are fenced on this exact lease
    // timestamp so a stale worker can never overwrite a takeover's state.
    const claimTime = new Date();
    const claimed = await db
      .update(scheduledSendsTable)
      .set({ status: "sending", claimedAt: claimTime })
      .where(
        and(
          eq(scheduledSendsTable.id, row.id),
          or(
            eq(scheduledSendsTable.status, "pending"),
            and(
              eq(scheduledSendsTable.status, "sending"),
              lte(scheduledSendsTable.claimedAt, staleClaim),
            ),
          ),
        ),
      )
      .returning({ id: scheduledSendsTable.id });
    if (claimed.length === 0) continue;

    const fenced = and(
      eq(scheduledSendsTable.id, row.id),
      eq(scheduledSendsTable.status, "sending"),
      eq(scheduledSendsTable.claimedAt, claimTime),
    );

    try {
      if (row.kind === "paid") {
        // The paid_wire_sends week-key claim (frozen snapshot + per-batch
        // idempotency keys) is the real double-send guard; this row is only
        // the trigger. Claim the ROW's week, never currentWeekKey() drift.
        const result = await executePaidSend(row.subject, row.bodyText, row.weekKey);
        if (result.ok || result.code === "already-sent") {
          await db
            .update(scheduledSendsTable)
            .set({ status: "sent", sentCount: result.sent, error: null, claimedAt: null })
            .where(fenced);
          logger.info({ weekKey: row.weekKey, sent: result.sent }, "scheduler: scheduled paid Wire sent");
        } else {
          const retryable = result.code === "send-failed" || result.code === "partial";
          await db
            .update(scheduledSendsTable)
            .set({ status: retryable ? "pending" : "failed", claimedAt: null, sentCount: result.sent, error: result.error })
            .where(fenced);
          logger.error({ code: result.code }, "scheduler: scheduled paid Wire send incomplete — " + (retryable ? "will retry" : "needs the publisher"));
        }
      } else {
        // Stable per-batch idempotency keys tied to this row make a retry of
        // the same scheduled Brief safe at Resend.
        const result = await executeBriefSend(row.subject, row.bodyText, `scheduled-brief-${row.id}`);
        if (result.sent === 0 && result.recipientCount > 0) {
          await db
            .update(scheduledSendsTable)
            .set({ status: "pending", claimedAt: null, error: "All batches failed — will retry" })
            .where(fenced);
          logger.error({ id: row.id }, "scheduler: scheduled Brief send failed — will retry");
        } else {
          await db
            .update(scheduledSendsTable)
            .set({
              status: "sent",
              sentCount: result.sent,
              claimedAt: null,
              error:
                result.failedCount > 0
                  ? `${result.failedCount} of ${result.recipientCount} recipients failed — see server logs`
                  : null,
            })
            .where(fenced);
          logger.info({ weekKey: row.weekKey, sent: result.sent, failed: result.failedCount }, "scheduler: scheduled Weekly Brief sent");
        }
      }
    } catch (err) {
      logger.error({ err, id: row.id }, "scheduler: scheduled send crashed — will retry");
      await db
        .update(scheduledSendsTable)
        .set({ status: "pending", claimedAt: null, error: String(err) })
        .where(fenced)
        .catch(() => undefined);
    }
  }
}

/**
 * Wednesday/Friday mid-week social highlight drafts: pick the week's ready
 * run and push a short one-signal Typefully draft (LinkedIn + X, unscheduled)
 * around 8 AM Pacific, with catch-up on later ticks the same day or the next.
 * Production only — a dev workspace open on a Wednesday must not push
 * duplicate drafts into the publisher's real Typefully account.
 *
 * The unique (kind, week_key) row in social_drafts is the claim: each slot is
 * attempted exactly once per week. A failed push is recorded and NOT retried
 * automatically — she can always post manually.
 */
function dueHighlightSlot(now = new Date()): "mon" | "wed" | "fri" | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const dow = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  // Monday short post: fires at 17:00 PT or later, after the wire run completes.
  // Tuesday before 8 am catches up a missed Monday.
  if (dow === "Mon" && hour >= 17) return "mon";
  if (dow === "Tue" && hour < 8) return "mon";
  if (dow === "Wed" && hour >= 8) return "wed";
  // Thursday catches up a missed Wednesday (autoscale may have slept).
  if (dow === "Thu") return "wed";
  if (dow === "Fri" && hour >= 8) return "fri";
  if (dow === "Sat") return "fri";
  return null;
}

async function tickSocialHighlights(): Promise<void> {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;
  if (!process.env.TYPEFULLY_API_KEY) return;
  const slot = dueHighlightSlot();
  if (!slot) return;
  const weekKey = currentWeekKey();

  // Only act on a ready run for THIS week — never resurface a stale week.
  const [run] = await db
    .select()
    .from(wireRunsTable)
    .where(and(eq(wireRunsTable.weekKey, weekKey), eq(wireRunsTable.status, "ready")))
    .limit(1);
  if (!run?.freeBody) return;

  // Atomic once-per-week claim with stale-pending takeover (crash recovery).
  const claim = await claimSocialDraft(slot, weekKey);
  if (!claim) return;

  // Wednesday and Friday avoid repeating an angle already posted this week.
  let avoidAngle: string | null = null;
  if (slot === "wed" || slot === "fri") {
    const earlier = await db
      .select({ kind: socialDraftsTable.kind, postText: socialDraftsTable.postText })
      .from(socialDraftsTable)
      .where(and(eq(socialDraftsTable.weekKey, weekKey), eq(socialDraftsTable.status, "pushed")));
    if (slot === "wed") {
      avoidAngle = earlier.find((d) => d.kind === "mon")?.postText ?? earlier.find((d) => d.kind === "brief")?.postText ?? null;
    } else {
      avoidAngle = earlier.find((d) => d.kind === "wed")?.postText ?? earlier.find((d) => d.kind === "mon")?.postText ?? null;
    }
  }

  const slotName = slot === "mon" ? "Monday" : slot === "wed" ? "Wednesday" : "Friday";
  const push = await pushHighlightToTypefully(slotName as "Monday" | "Wednesday" | "Friday", weekKey, run.freeBody, avoidAngle);
  await db
    .update(socialDraftsTable)
    .set({
      status: push.ok ? "pushed" : "failed",
      typefullyDraftId: push.draftId ?? null,
      postText: push.linkedinText ?? null,
      error: push.ok ? null : push.status,
    })
    .where(eq(socialDraftsTable.id, claim.id));
  if (push.ok) {
    logger.info({ weekKey, slot }, "scheduler: mid-week social highlight pushed to Typefully");
  } else {
    logger.error({ weekKey, slot, reason: push.status }, "scheduler: mid-week social highlight failed");
    await notifySocialFailure(slotName, push.status);
  }
}

async function notifySocialFailure(slotName: string, reason: string): Promise<void> {
  try {
    await resendRequest("/emails", {
      method: "POST",
      body: {
        from: FROM_ADDRESS,
        to: ["hello@hollywoodsaleswire.com"],
        subject: `${slotName} LinkedIn/X draft did not reach Typefully`,
        text: `Karilyn,\n\nThis week's ${slotName} social highlight could not be pushed to Typefully (${reason}).\n\nNo action needed for the Wire — this only affects the social draft. You can post manually this week, or ask your agent to look into it.\n\n— Hollywood Sales Wire research desk`,
      },
    });
  } catch (err) {
    logger.error({ err }, "scheduler: failed to send social-failure notice");
  }
}

/**
 * Returns true on Tuesday, Wednesday, or Thursday at or after 8 AM PT.
 * The same batch-tag dedup below prevents a second campaign if the server
 * restarts mid-day on a launch day.
 */
function isColdCampaignDue(now = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const dow = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  return (dow === "Tue" || dow === "Wed" || dow === "Thu") && hour >= 8;
}

/** Tracks the PT date of the last cold campaign created in this process. */
let lastColdBatchDay: string | null = null;

function ptDateString(now = new Date()): string {
  return now.toLocaleDateString("en-US", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Creates one Instantly cold campaign batch per Tue/Wed/Thu launch day.
 * Production only. The in-memory date guard means at most one batch per
 * calendar day regardless of how often the scheduler ticks.
 */
async function tickColdCampaigns(): Promise<void> {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;
  if (!process.env.INSTANTLY_API_KEY) return;
  if (!isColdCampaignDue()) return;
  const today = ptDateString();
  if (lastColdBatchDay === today) return;
  lastColdBatchDay = today; // claim before await — prevents concurrent ticks racing
  try {
    const result = await createColdBatch(new Date());
    logger.info(
      { campaignId: result.campaignId, batchTag: result.batchTag, deadline: result.deadline },
      "scheduler: cold campaign batch created and active — add leads in Instantly to begin sending",
    );
  } catch (err) {
    lastColdBatchDay = null; // release so next tick retries
    logger.error({ err }, "scheduler: cold campaign batch creation failed — will retry next tick");
  }
}

async function tick(): Promise<void> {
  try {
    await tickPendingEmails();
  } catch (err) {
    logger.error({ err }, "pending-email tick failed");
  }
  try {
    await tickReportDeliveries();
  } catch (err) {
    logger.error({ err }, "report-delivery tick failed");
  }
  try {
    await tickScheduledSends();
  } catch (err) {
    logger.error({ err }, "scheduled-send tick failed");
  }
  try {
    await tickSocialHighlights();
  } catch (err) {
    logger.error({ err }, "social-highlight tick failed");
  }
  try {
    await tickColdCampaigns();
  } catch (err) {
    logger.error({ err }, "cold-campaign tick failed");
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
