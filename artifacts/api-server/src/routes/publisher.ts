import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import {
  db,
  emailSubscribersTable,
  weeklyPreviewsTable,
  membersTable,
  paidWireSendsTable,
  specialReportsTable,
} from "@workspace/db";
import { executeBriefSend, executePaidSend } from "../lib/sendWire";
import { listTrackedProjectStages } from "../lib/productionStage";
import { PublisherSendResponse } from "@workspace/api-zod";
import { currentWeekKey } from "../lib/wireResearch";
import { ObjectStorageService } from "../lib/objectStorage";
import { deliverReportsToPendingMembers } from "../lib/members";
import {
  uploadColdLeads,
  getLatestColdCampaign,
  validateColdLead,
  type ColdLead,
} from "../lib/coldCampaigns";

const router: IRouter = Router();

const REPORT_DEFINITIONS = [
  { slug: "spend-map", title: "Under the Hood: The WBD AI Buildout" },
  { slug: "greenlight-window", title: "The $6.6 Billion Greenlight Window" },
  { slug: "requisition-read", title: "Help-Wanted Pages Are Purchase Orders" },
] as const;

const storageService = new ObjectStorageService();

function keyOk(key: unknown): boolean {
  const expected = process.env.PUBLISHER_KEY;
  if (typeof key !== "string" || !expected) return false;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const COMP_PLANS = new Set(["founding-individual", "founding-team", "individual", "team", "member"]);

/**
 * POST /publisher/comp-member — add a complimentary member (no Stripe).
 * Sends the standard welcome email (with Shelf link), Special Reports for
 * founding plans, and the latest Wire issue. Idempotent on email.
 */
router.post("/publisher/comp-member", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const plan = typeof req.body?.plan === "string" ? req.body.plan : "founding-individual";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (!COMP_PLANS.has(plan)) {
    res.status(400).json({ error: "Unknown plan." });
    return;
  }
  try {
    const { createCompMember } = await import("../lib/members");
    const result = await createCompMember(email, plan);
    res.json(result);
  } catch (err) {
    req.log?.error?.({ err }, "comp-member failed");
    res.status(502).json({ error: "Could not add the member — please try again." });
  }
});

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
  const result = await executeBriefSend(subject, bodyText);
  if (result.sent === 0 && result.recipientCount > 0) {
    res.status(502).json({ error: "Sending failed — nothing went out. Please try again." });
    return;
  }
  res.json(PublisherSendResponse.parse({ sent: result.sent }));
});

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
  const result = await executePaidSend(subject, bodyText);
  if (result.ok) {
    res.json(PublisherSendResponse.parse({ sent: result.sent }));
    return;
  }
  const statusByCode = { "no-recipients": 400, "already-sent": 409, "send-failed": 502, partial: 502 } as const;
  res.status(statusByCode[result.code]).json({ error: result.error });
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

// ---------------------------------------------------------------------------
// Special Reports management
// ---------------------------------------------------------------------------

/** Idempotent: inserts the three report rows if they don't exist yet. */
async function ensureReportRows(): Promise<void> {
  for (const r of REPORT_DEFINITIONS) {
    await db
      .insert(specialReportsTable)
      .values({ slug: r.slug, title: r.title })
      // Heal stale titles: if the row exists with an old title (e.g. rows
      // created before the Aug 2026 report renames), bring it up to date.
      .onConflictDoUpdate({
        target: specialReportsTable.slug,
        set: { title: r.title },
      });
  }
}

router.get("/publisher/reports", async (req, res): Promise<void> => {
  if (!keyOk(req.query.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  await ensureReportRows();

  const rows = await db.select().from(specialReportsTable);
  const reportsMap = new Map(rows.map((r) => [r.slug, r]));

  const reports = REPORT_DEFINITIONS.map((def) => {
    const row = reportsMap.get(def.slug);
    return {
      slug: def.slug,
      title: def.title,
      uploaded: !!(row?.objectPath),
      ...(row?.uploadedAt ? { uploadedAt: row.uploadedAt.toISOString() } : {}),
    };
  });

  // Count founding members who haven't received reports yet
  const [{ count: pendingMemberCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(membersTable)
    .where(
      sql`${membersTable.specialReportsDeliveredAt} IS NULL`,
    );

  res.json({ reports, pendingMemberCount });
});

router.post("/publisher/reports/upload-url", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
  if (!REPORT_DEFINITIONS.find((d) => d.slug === slug)) {
    res.status(400).json({ error: "Unknown report slug" });
    return;
  }
  try {
    const uploadUrl = await storageService.getObjectEntityUploadURL();
    res.json({ uploadUrl, slug });
  } catch (err) {
    console.error("reports upload-url error:", err);
    res.status(502).json({ error: "Could not generate upload URL" });
  }
});

router.post("/publisher/reports/confirm", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim() : "";
  const uploadedUrl = typeof req.body?.uploadedUrl === "string" ? req.body.uploadedUrl.trim() : "";
  if (!REPORT_DEFINITIONS.find((d) => d.slug === slug) || !uploadedUrl) {
    res.status(400).json({ error: "slug and uploadedUrl are required" });
    return;
  }

  // Normalize GCS presigned URL → /objects/... path
  const objectPath = storageService.normalizeObjectEntityPath(uploadedUrl);

  // Validate: must be under the uploads prefix (not an arbitrary object path).
  // getObjectEntityUploadURL always writes to ${PRIVATE_OBJECT_DIR}/uploads/<uuid>
  // which normalizes to /objects/uploads/<uuid>.
  if (!objectPath.startsWith("/objects/uploads/")) {
    res.status(400).json({ error: "Uploaded URL does not point to an expected object path" });
    return;
  }

  // Validate: object exists and is a PDF.
  let contentType: string;
  try {
    const { ObjectStorageService: _OSS, ...rest } = await import("../lib/objectStorage");
    void rest;
    const file = await storageService.getObjectEntityFile(objectPath);
    const [metadata] = await file.getMetadata();
    contentType = String(metadata.contentType ?? "");
  } catch {
    res.status(400).json({ error: "Uploaded object could not be found in storage" });
    return;
  }
  if (!contentType.startsWith("application/pdf")) {
    res.status(400).json({ error: "Uploaded file must be a PDF (got: " + contentType + ")" });
    return;
  }

  await ensureReportRows();
  await db
    .update(specialReportsTable)
    .set({ objectPath, uploadedAt: new Date() })
    .where(eq(specialReportsTable.slug, slug));

  // Deliver to any founding members still waiting for their reports
  let deliveredCount = 0;
  try {
    deliveredCount = await deliverReportsToPendingMembers();
  } catch (err) {
    console.error("reports confirm: delivery error:", err);
  }

  res.json({ slug, objectPath, deliveredCount });
});

/**
 * GET /publisher/production-stages — tracked projects (entity formations and
 * incentive awards) with their modeled current hiring/vendor-buying stage.
 * These are elapsed-time estimates from a typical production timeline, not
 * confirmed hiring status for any named project.
 */
router.get("/publisher/production-stages", async (req, res): Promise<void> => {
  if (!keyOk(req.query.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const projects = await listTrackedProjectStages();
  res.json({ projects });
});

/**
 * POST /publisher/cold-leads
 * Upload prospect leads to the latest active cold campaign.
 *
 * Body: { key, leads: [{email, first_name, last_name?, company?}] }
 *
 * Enforces the gradual weekly contact cap automatically; any leads that would
 * push over the campaign's cap are skipped and reported in the response. The
 * RIA Wire agent or any automated tool can call this endpoint — no Instantly
 * UI access needed.
 *
 * Example curl:
 *   curl -X POST https://hollywoodsaleswire.com/api/publisher/cold-leads \
 *     -H "Content-Type: application/json" \
 *     -d '{"key":"<PUBLISHER_KEY>","leads":[{"email":"jane@studio.com","first_name":"Jane","company":"Acme Films"}]}'
 */
router.post("/publisher/cold-leads", async (req, res): Promise<void> => {
  if (!keyOk(req.body?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }

  const raw = req.body?.leads;
  if (!Array.isArray(raw) || raw.length === 0) {
    res.status(400).json({ error: "leads must be a non-empty array" });
    return;
  }

  // Only named people with person-specific mailboxes may enter cold outreach.
  const leads: ColdLead[] = [];
  for (const item of raw) {
    if (typeof item?.email !== "string" || typeof item?.first_name !== "string") {
      res.status(400).json({ error: "Every lead must include an email and first_name" });
      return;
    }
    const lead: ColdLead = {
      email: item.email,
      first_name: item.first_name,
      last_name: typeof item.last_name === "string" ? item.last_name : undefined,
      company: typeof item.company === "string" ? item.company : undefined,
    };
    const validationError = validateColdLead(lead);
    if (validationError) {
      res.status(400).json({ error: `Invalid lead — ${validationError}` });
      return;
    }
    leads.push(lead);
  }

  // Check a campaign exists before doing any work.
  const campaign = await getLatestColdCampaign();
  if (!campaign) {
    res.status(409).json({ error: "No cold campaign found — wait for the scheduler to create one" });
    return;
  }

  try {
    const result = await uploadColdLeads(leads);
    res.json(result);
  } catch (err) {
    console.error("cold-leads upload error:", err);
    res.status(500).json({ error: String(err) });
  }
});

/**
 * GET /publisher/cold-campaign — status of the latest cold campaign batch.
 * Returns campaign ID, daily limit, leads uploaded so far, and slots remaining.
 */
router.get("/publisher/cold-campaign", async (req, res): Promise<void> => {
  if (!keyOk(req.query?.key)) {
    res.status(401).json({ error: "Invalid key" });
    return;
  }
  const campaign = await getLatestColdCampaign();
  if (!campaign) {
    res.status(404).json({ error: "No cold campaign found yet" });
    return;
  }
  res.json({
    campaignId: campaign.campaignId,
    batchTag: campaign.batchTag,
    deadline: campaign.deadline,
    dailyLimit: campaign.dailyLimit,
    leadsUploaded: campaign.leadsUploaded,
    remaining: Math.max(0, 40 - campaign.leadsUploaded),
    createdAt: campaign.createdAt,
  });
});

export default router;
