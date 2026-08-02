import { eq } from "drizzle-orm";
import { db, wireRunsTable } from "@workspace/db";
import { runWeeklyResearch, currentWeekKey } from "./wireResearch";
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

async function tick(): Promise<void> {
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
