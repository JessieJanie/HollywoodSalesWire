import { and, eq } from "drizzle-orm";
import { db, paidWireSendsTable, publisherAlertsTable, wireRunsTable } from "@workspace/db";
import {
  decideStaleRun,
  draftAlertDue,
  draftLateAlertKey,
  issueLateAlertKey,
  sendAlertDue,
  staleRetryAlertKey,
} from "./deliveryReliability";
import { FROM_ADDRESS } from "./emailSequence";
import { logger } from "./logger";
import { resendRequest } from "./resend";
import { currentWeekKey, runWeeklyResearch } from "./wireResearch";

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

/** Tell the publisher when Monday's draft or Tuesday's paid issue is late. */
export async function alertMissedDeliveryDeadlines(now = new Date()): Promise<void> {
  const week = currentWeekKey(now);
  if (draftAlertDue(now)) {
    const [run] = await db
      .select({ status: wireRunsTable.status, wireMarkdown: wireRunsTable.wireMarkdown })
      .from(wireRunsTable)
      .where(eq(wireRunsTable.weekKey, week))
      .limit(1);
    const ready = run?.status === "ready" && Boolean(run.wireMarkdown && run.wireMarkdown.trim().length > 0);
    if (!ready) {
      await alertOnce(
        draftLateAlertKey(week),
        `Monday's Wire draft is not ready — week of ${week}`,
        `Karilyn,\n\nIt is past 5:00 AM Pacific on Tuesday and the week of ${week} does not have a ready draft in the publisher console (status: ${run?.status ?? "no run"}).\n\nNothing has been sent. Open the publisher console and press "Run research now" if the row is failed or missing.\n\n— Hollywood Sales Wire research desk`,
      );
    }
  }

  if (sendAlertDue(now)) {
    const [sent] = await db
      .select({ status: paidWireSendsTable.status })
      .from(paidWireSendsTable)
      .where(eq(paidWireSendsTable.weekKey, week))
      .limit(1);
    if (sent?.status !== "sent") {
      await alertOnce(
        issueLateAlertKey(week),
        `Tuesday's issue has not been sent — week of ${week}`,
        `Karilyn,\n\nIt is past 12:00 PM Pacific on Tuesday and the paid Wire for the week of ${week} is not marked sent (status: ${sent?.status ?? "not started"}).\n\nNothing sends by itself. Open the publisher console and use Approve and send when the draft looks right.\n\n— Hollywood Sales Wire research desk`,
      );
    }
  }
}

export async function tickDeliveryReliability(now = new Date()): Promise<void> {
  await reapStaleResearchRuns(now);
  await alertMissedDeliveryDeadlines(now);
}
