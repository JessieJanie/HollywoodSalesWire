/**
 * GET /sample — one real paid issue, chosen in the publisher console.
 * Rendered as HTML on the server so a crawler does not need JavaScript.
 */
import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db, paidWireSendsTable, publicSamplesTable, wireRunsTable } from "@workspace/db";
import { SITE_URL } from "../lib/emailSequence";
import { renderSamplePage, sampleSourcesFromRun } from "../lib/sampleIssue";

const router: Router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const [selected] = await db
    .select()
    .from(publicSamplesTable)
    .orderBy(desc(publicSamplesTable.selectedAt))
    .limit(1);
  if (!selected) {
    res.status(200).type("html").send(renderSamplePage(null, SITE_URL));
    return;
  }
  const [issue] = await db
    .select()
    .from(paidWireSendsTable)
    .where(eq(paidWireSendsTable.weekKey, selected.weekKey))
    .limit(1);
  const [run] = await db
    .select({ sources: wireRunsTable.sources })
    .from(wireRunsTable)
    .where(eq(wireRunsTable.weekKey, selected.weekKey))
    .limit(1);
  if (!issue || issue.status !== "sent") {
    res.status(200).type("html").send(renderSamplePage(null, SITE_URL));
    return;
  }
  res.status(200).type("html").send(
    renderSamplePage(
      {
        weekKey: issue.weekKey,
        subject: issue.subject,
        bodyText: issue.bodyText,
        sources: sampleSourcesFromRun(run?.sources),
      },
      SITE_URL,
    ),
  );
});

export default router;
