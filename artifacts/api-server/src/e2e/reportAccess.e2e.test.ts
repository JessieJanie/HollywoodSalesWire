/**
 * E2E check (Task: canceled Founding Members keep Special Report access).
 *
 * Runs only when RUN_E2E=1 (needs a live api-server, dev database, and object
 * storage). Seeds a test founding member with a canceled subscription
 * (members row + stripe.subscriptions row where possible), uploads a tiny
 * test PDF to object storage, points a special_reports row at it, then
 * exercises the live download route:
 *   1. canceled founding member + valid link  -> 200, PDF streamed
 *   2. non-founding email + valid link        -> 403
 *   3. expired link (valid sig)               -> 403
 * Cleans up all test rows afterwards (restores prior object_path).
 *
 * Usage: RUN_E2E=1 pnpm --filter @workspace/api-server exec vitest run src/e2e
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { reportDownloadUrl, signMemberSlug } from "../routes/reports";
import { ObjectStorageService } from "../lib/objectStorage";

const RUN = process.env.RUN_E2E === "1";
const BASE = process.env.E2E_BASE_URL ?? "http://localhost:80";
const SLUG = "spend-map";
const CANCELED_EMAIL = "e2e-canceled-founder@test.hollywoodsaleswire.com";
const NON_FOUNDING_EMAIL = "e2e-regular-member@test.hollywoodsaleswire.com";
const SUB_ID = "sub_e2e_canceled_task21";

const MINI_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n0\n%%EOF\n",
);

describe.runIf(RUN)("e2e: special report download entitlement", () => {
  let prevObjectPath: string | null = null;
  let hadRow = false;
  let stripeRowInserted = false;

  beforeAll(async () => {
    const storage = new ObjectStorageService();

    // Upload a tiny test PDF
    const uploadUrl = await storage.getObjectEntityUploadURL();
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: MINI_PDF,
    });
    if (!putRes.ok) throw new Error(`test PDF upload failed: ${putRes.status}`);
    const objectPath = storage.normalizeObjectEntityPath(uploadUrl.split("?")[0]);

    // Seed DB rows
    const prev = await db.execute(
      sql`select object_path from special_reports where slug = ${SLUG}`,
    );
    hadRow = prev.rows.length > 0;
    prevObjectPath = (prev.rows[0]?.object_path as string | null) ?? null;

    await db.execute(sql`
      insert into special_reports (slug, title, object_path, uploaded_at)
      values (${SLUG}, 'The Spend Map (e2e placeholder title)', ${objectPath}, now())
      on conflict (slug) do update set object_path = ${objectPath}, uploaded_at = now()
    `);

    await db.execute(sql`
      insert into members (email, plan, stripe_subscription_id, stripe_customer_id)
      values (${CANCELED_EMAIL}, 'founding-individual', ${SUB_ID}, 'cus_e2e_task21'),
             (${NON_FOUNDING_EMAIL}, 'member', null, null)
      on conflict (email) do nothing
    `);

    // Reflect the cancellation in stripe.subscriptions (synced schema — may be
    // read-only; the download route intentionally never consults it, so a
    // failure here is non-fatal).
    try {
      await db.execute(sql`
        insert into stripe.subscriptions (id, status)
        values (${SUB_ID}, 'canceled')
        on conflict (id) do update set status = 'canceled'
      `);
      stripeRowInserted = true;
    } catch (e) {
      console.log(
        `NOTE: could not write stripe.subscriptions (${(e as Error).message}) — route does not consult it; continuing`,
      );
    }
  }, 60_000);

  afterAll(async () => {
    await db.execute(
      sql`delete from members where email in (${CANCELED_EMAIL}, ${NON_FOUNDING_EMAIL})`,
    );
    if (hadRow) {
      await db.execute(
        sql`update special_reports set object_path = ${prevObjectPath}, uploaded_at = case when ${prevObjectPath}::text is null then null else uploaded_at end where slug = ${SLUG}`,
      );
    } else {
      await db.execute(sql`delete from special_reports where slug = ${SLUG}`);
    }
    if (stripeRowInserted) {
      try {
        await db.execute(sql`delete from stripe.subscriptions where id = ${SUB_ID}`);
      } catch {
        /* ignore */
      }
    }
  }, 60_000);

  it("canceled founding member gets the PDF (200, application/pdf)", async () => {
    const url = reportDownloadUrl(CANCELED_EMAIL, SLUG, BASE);
    const res = await fetch(url);
    const body = Buffer.from(await res.arrayBuffer());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toContain("pdf");
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
  }, 30_000);

  it("non-founding member is denied (403)", async () => {
    const url = reportDownloadUrl(NON_FOUNDING_EMAIL, SLUG, BASE);
    const res = await fetch(url);
    expect(res.status).toBe(403);
  }, 30_000);

  it("expired LEGACY link is denied (403); permanent links have no expiry", async () => {
    // Legacy pre-Aug-2026 links carried an exp param covered by the old
    // signature scheme. Those still honor their expiry. New links never expire.
    const pastExp = Date.now() - 60_000;
    const { createHmac } = await import("node:crypto");
    const sig = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(`report-download:${CANCELED_EMAIL.toLowerCase()}:${SLUG}:${pastExp}`)
      .digest("hex");
    const url = `${BASE}/api/reports/download/${SLUG}?email=${encodeURIComponent(CANCELED_EMAIL)}&exp=${pastExp}&sig=${sig}`;
    const res = await fetch(url);
    expect(res.status).toBe(403);
  }, 30_000);
});
