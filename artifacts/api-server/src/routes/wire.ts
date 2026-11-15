import { Router, type IRouter } from "express";
import { desc, eq, and } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { db, wireRunsTable } from "@workspace/db";
import { runWeeklyResearch } from "../lib/wireResearch";
import { normalizeWireDateline } from "../lib/wireDateline";

const router: IRouter = Router();

function keyOk(key: unknown): boolean {
  const expected = process.env.PUBLISHER_KEY;
  if (typeof key !== "string" || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

router.get("/publisher/wire/latest", async (req, res): Promise<void> => {
  if (!keyOk(req.query.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const [run] = await db
    .select()
    .from(wireRunsTable)
    .orderBy(desc(wireRunsTable.startedAt))
    .limit(1);
  if (!run) {
    res.json({ status: "none" });
    return;
  }
  res.json({
    status: run.status,
    weekKey: run.weekKey,
    startedAt: run.startedAt.toISOString(),
    ...(run.finishedAt ? { finishedAt: run.finishedAt.toISOString() } : {}),
    ...(run.error ? { error: run.error } : {}),
    ...(run.wireMarkdown ? { wireMarkdown: run.wireMarkdown } : {}),
    ...(run.freeSubject ? { freeSubject: run.freeSubject } : {}),
    ...(run.freeBody ? { freeBody: run.freeBody } : {}),
    ...(run.sources ? { sources: run.sources } : {}),
    ...(run.draftReadyNotifiedAt ? { draftReadyNotifiedAt: run.draftReadyNotifiedAt.toISOString() } : {}),
    ...(run.autoSendHoldAt ? { autoSendHeld: true } : {}),
    ...(run.autoSendState ? { autoSendState: run.autoSendState } : {}),
  });
});

router.post("/publisher/wire/hold", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const { currentWeekKey } = await import("../lib/wireResearch");
  const weekKey = currentWeekKey();
  const held = await db
    .update(wireRunsTable)
    .set({ autoSendHoldAt: new Date() })
    .where(and(eq(wireRunsTable.weekKey, weekKey), eq(wireRunsTable.status, "ready")))
    .returning({ weekKey: wireRunsTable.weekKey });
  if (held.length === 0) {
    res.status(409).json({ error: "No current ready draft to hold." });
    return;
  }
  res.json({ weekKey, held: true });
});

router.patch("/publisher/wire/save", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const wireMarkdown = typeof req.body?.wireMarkdown === "string" ? req.body.wireMarkdown.trim() : "";
  if (wireMarkdown.length < 100) {
    res.status(400).json({ error: "wireMarkdown too short." });
    return;
  }
  const [run] = await db
    .select({ weekKey: wireRunsTable.weekKey, status: wireRunsTable.status })
    .from(wireRunsTable)
    .orderBy(desc(wireRunsTable.startedAt))
    .limit(1);
  if (!run || run.status !== "ready") {
    res.status(409).json({ error: "No ready draft to update." });
    return;
  }
  await db
    .update(wireRunsTable)
    .set({
      wireMarkdown: normalizeWireDateline(wireMarkdown, run.weekKey),
      autoSendHoldAt: new Date(),
    })
    .where(eq(wireRunsTable.weekKey, run.weekKey));
  res.json({ weekKey: run.weekKey, saved: true });
});

router.post("/publisher/wire/run", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const weekKey = typeof req.body?.weekKey === "string" ? req.body.weekKey : undefined;
  const result = await runWeeklyResearch("manual", weekKey);
  res.status(result.started ? 202 : 409).json(
    result.started ? { status: "started" } : { error: result.reason ?? "Could not start." },
  );
});

export default router;
