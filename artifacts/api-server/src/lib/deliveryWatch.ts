import { and, eq } from "drizzle-orm";
import { db, paidWireSendsTable, publisherAlertsTable, weeklyPreviewsTable, wireRunsTable } from "@workspace/db";
import {
  decideStaleRun,
  deliveryAlert,
  staleRetryAlertKey,
} from "./deliveryReliability";
import { FROM_ADDRESS } from "./emailSequence";
import { logger } from "./logger";
import { resendRequest } from "./resend";
import { currentWeekKey, runWeeklyResearch } from "./wireResearch";
import { AUTO_SENT_STATUS, decideAutoSend } from "./autoSend";
import { executeBriefSend, executePaidSend } from "./sendWire";

const NOTIFY_EMAIL = "hello@hollywoodsaleswire.com";

async function claimAlert(alertKey: string): Promise<boolean> {
  const inserted = await db
    .insert(publisherAlertsTable)
    .values({ alertKey })
    .onConflictDoNothing({ target: publisherAlertsTable.alertKey })
    .returning({ id: publisherAlertsTable.id });
  return inserted.length > 0;
}

async function releaseAlert(alertKey: string): Promise<void> {
  await db.delete(publisherAlertsTable).where(eq(publisherAlertsTable.alertKey, alertKey));
}

async function notifyPublisher(subject: string, text: string): Promise<void> {
  await resendRequest("/emails", {
    method: "POST",
    body: {
      from: FROM_ADDRESS,
      to: [NOTIFY_EMAIL],
      subject,
      text,
    },
  });
}

/**
 * Close research rows left in `running` after a crash, and retry the current
 * week at most once. Past weeks — including the runs stuck since October 26
 * and November 2 — are closed and not re-bought.
 */
export async function reapStaleResearchRuns(now = new Date()): Promise<void> {
  const running = await db.select().from(wireRunsTable).where(eq(wireRunsTable.status, "running"));
  const week = currentWeekKey(now);
  for (const run of running) {
    const retryKey = staleRetryAlertKey(run.id);
    const [priorRetry] = await db
      .select({ id: publisherAlertsTable.id })
      .from(publisherAlertsTable)
      .where(eq(publisherAlertsTable.alertKey, retryKey))
      .limit(1);
    const decision = decideStaleRun({
      status: run.status,
      startedAt: run.startedAt,
      weekKey: run.weekKey,
      now,
      currentWeekKey: week,
      alreadyRetried: Boolean(priorRetry),
    });
    if (decision.action === "leave") continue;

    if (decision.action === "retry") {
      const claimed = await claimAlert(retryKey);
      if (!claimed) continue;
    }

    const closed = await db
      .update(wireRunsTable)
      .set({ status: "failed", finishedAt: now, error: decision.error })
      .where(
        and(
          eq(wireRunsTable.id, run.id),
          eq(wireRunsTable.status, "running"),
          eq(wireRunsTable.startedAt, run.startedAt),
        ),
      )
      .returning({ id: wireRunsTable.id, weekKey: wireRunsTable.weekKey });
    if (closed.length === 0) {
      if (decision.action === "retry") await releaseAlert(retryKey);
      continue;
    }

    logger.warn({ runId: run.id, weekKey: run.weekKey, action: decision.action }, "stale research run reaped");
    const mayEmail = process.env.REPLIT_DEPLOYMENT === "1";
    if (decision.action === "retry") {
      if (mayEmail) {
        try {
          await notifyPublisher(
            `Research run for the week of ${run.weekKey} is being retried once`,
            `Karilyn,\n\nThe Monday research run for the week of ${run.weekKey} was still marked running after ${Math.round(
              (now.getTime() - run.startedAt.getTime()) / 60000,
            )} minutes, so the process that started it is gone. It is being retried once automatically. If that retry also stalls, it will be closed and you can press "Run research now".\n\nNothing sends until you click send.`,
          );
        } catch (err) {
          logger.error({ err, runId: run.id }, "stale-run retry notice failed");
        }
      }
      try {
        await runWeeklyResearch("manual");
      } catch (err) {
        logger.error({ err, runId: run.id }, "stale-run retry failed to start");
      }
      continue;
    }

    if (!mayEmail) continue;
    try {
      await notifyPublisher(
        `Research run closed — week of ${run.weekKey}`,
        `Karilyn,\n\nA research run for the week of ${run.weekKey} was stuck in "running" and has been closed.\n\n${decision.error}\n\nNo research was re-bought for a week that has passed. The current week can still be started with "Run research now" if its own row is failed.`,
      );
    } catch (err) {
      logger.error({ err, runId: run.id }, "stale-run close notice failed");
    }
  }
}

async function alertOnce(alertKey: string, subject: string, text: string): Promise<void> {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;
  const claimed = await claimAlert(alertKey);
  if (!claimed) return;
  try {
    await notifyPublisher(subject, text);
  } catch (err) {
    await releaseAlert(alertKey);
    logger.error({ err, alertKey }, "publisher deadline alert failed — will retry");
  }
}

/** Tell the publisher when this Tuesday's draft is missing or its issue is unsent. */
export async function alertMissedDeliveryDeadlines(now = new Date()): Promise<void> {
  const week = currentWeekKey(now);
  const [run] = await db
    .select({ status: wireRunsTable.status, wireMarkdown: wireRunsTable.wireMarkdown })
    .from(wireRunsTable)
    .where(eq(wireRunsTable.weekKey, week))
    .limit(1);
  const [sent] = await db
    .select({ status: paidWireSendsTable.status })
    .from(paidWireSendsTable)
    .where(eq(paidWireSendsTable.weekKey, week))
    .limit(1);
  const decision = deliveryAlert({
    now,
    weekKey: week,
    runStatus: run?.status ?? "none",
    hasReadyDraft: run?.status === "ready" && Boolean(run.wireMarkdown && run.wireMarkdown.trim().length > 0),
    paidStatus: sent?.status ?? null,
  });
  if (decision.action === "none") return;
  const subject = decision.action === "draft-missing"
    ? `Monday's Wire draft is missing — week of ${decision.weekKey}`
    : `Tuesday's issue has not been sent — week of ${decision.weekKey}`;
  await alertOnce(decision.alertKey, subject, decision.text);
}

export async function tickDeliveryReliability(now = new Date()): Promise<void> {
  await reapStaleResearchRuns(now);
  await alertMissedDeliveryDeadlines(now);
  await tickAutoSend(now);
}

/**
 * Publish the current week's ready draft 24 hours after the review email
 * unless the publisher held it, already sent it, or the draft has no source links.
 * Production only — a dev process must not mail the lists.
 */
export async function tickAutoSend(now = new Date()): Promise<void> {
  if (process.env.REPLIT_DEPLOYMENT !== "1") return;
  const week = currentWeekKey(now);
  const [run] = await db.select().from(wireRunsTable).where(eq(wireRunsTable.weekKey, week)).limit(1);
  if (!run) return;
  const [paid] = await db
    .select({ status: paidWireSendsTable.status })
    .from(paidWireSendsTable)
    .where(eq(paidWireSendsTable.weekKey, week))
    .limit(1);
  const previews = run.freeSubject
    ? await db
        .select({ sentAt: weeklyPreviewsTable.sentAt })
        .from(weeklyPreviewsTable)
        .where(eq(weeklyPreviewsTable.subject, run.freeSubject))
    : [];
  const briefAlreadySent = Boolean(
    run.draftReadyNotifiedAt
    && previews.some((preview) => preview.sentAt.getTime() >= run.draftReadyNotifiedAt!.getTime()),
  );
  const decision = decideAutoSend({
    draft: {
      weekKey: run.weekKey,
      status: run.status,
      wireMarkdown: run.wireMarkdown,
      freeSubject: run.freeSubject,
      freeBody: run.freeBody,
      sources: run.sources,
      draftReadyNotifiedAt: run.draftReadyNotifiedAt,
      autoSendHoldAt: run.autoSendHoldAt,
      autoSendState: run.autoSendState,
    },
    now,
    currentWeekKey: week,
    paidAlreadySent: paid?.status === "sent" || paid?.status === AUTO_SENT_STATUS,
    briefAlreadySent,
  });
  if (decision.action !== "send") return;

  const alertKey = `auto-send:${week}`;
  const claimed = await claimAlert(alertKey);
  if (!claimed) return;
  try {
    const [fresh] = await db.select().from(wireRunsTable).where(eq(wireRunsTable.id, run.id)).limit(1);
    if (!fresh || fresh.autoSendHoldAt || fresh.weekKey !== week) {
      await releaseAlert(alertKey);
      return;
    }
    if (decision.paid) {
      const result = await executePaidSend(decision.paid.subject, decision.paid.bodyText, week, AUTO_SENT_STATUS);
      if (!result.ok && result.code !== "already-sent") {
        throw new Error(result.error);
      }
    }
    if (decision.brief) {
      const result = await executeBriefSend(
        decision.brief.subject,
        decision.brief.bodyText,
        `auto-brief-${week}`,
        AUTO_SENT_STATUS,
      );
      if (result.sent === 0 && result.recipientCount > 0) {
        throw new Error("Weekly Brief batches failed");
      }
    }
    await db
      .update(wireRunsTable)
      .set({ autoSendState: AUTO_SENT_STATUS })
      .where(eq(wireRunsTable.id, run.id));
    await notifyPublisher(
      `Week of ${week} was sent automatically`,
      `Karilyn,\n\nThe ready draft for the week of ${week} was not approved, edited, or held within 24 hours of the review email, so it was published as it stood. The send is marked ${AUTO_SENT_STATUS}.\n\nThe paid Wire went only to members whose Stripe subscription is active. The Weekly Brief went to the free list.\n\n— Hollywood Sales Wire research desk`,
    );
  } catch (err) {
    await releaseAlert(alertKey);
    logger.error({ err, week }, "auto-send failed — will retry");
  }
}
