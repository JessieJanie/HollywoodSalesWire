import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, specialReportsTable, membersTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const storageService = new ObjectStorageService();

/**
 * Default link TTL: 1 year from issue time, in milliseconds.
 * Links in member emails are valid for this duration. The email copy tells
 * members to reply if they need a refreshed link after expiry.
 */
export const REPORT_LINK_TTL_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * Compute a per-member, per-slug, time-bound HMAC signature.
 *
 * The signature covers email + slug + expiry so the link cannot be extended
 * or re-targeted after it is issued. The email parameter is in the URL (not
 * in a session), so a link CAN be forwarded — the expiry limits the exposure
 * window, and the founding-member entitlement check on the server side means
 * only founding members can actually obtain a valid link in the first place.
 *
 * Special Reports are the founding member's to keep: cancellation does NOT
 * revoke download access (publisher policy — the offer says "yours to keep").
 */
export function signMemberSlug(email: string, slug: string, expMs: number): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", secret)
    .update(`report-download:${email.toLowerCase()}:${slug}:${expMs}`)
    .digest("hex");
}

/**
 * Build a time-limited download URL for a report.
 * Exported so members.ts can call it without importing the route module.
 */
export function reportDownloadUrl(
  email: string,
  slug: string,
  siteUrl: string,
  expMs?: number,
): string {
  const exp = expMs ?? Date.now() + REPORT_LINK_TTL_MS;
  const sig = signMemberSlug(email, slug, exp);
  return (
    `${siteUrl}/api/reports/download/${encodeURIComponent(slug)}` +
    `?email=${encodeURIComponent(email.toLowerCase())}&exp=${exp}&sig=${sig}`
  );
}

/**
 * GET /reports/download/:slug?email=<addr>&exp=<ms>&sig=<hmac>
 *
 * Time-limited per-issue download. The HMAC covers email, slug, and expiry
 * so links cannot be extended. Links are valid for 1 year from issue.
 *
 * Note: the email is in the URL, so the link is transferable during its
 * validity window. It is guarded only by HMAC integrity, expiry, and a
 * founding-member entitlement check on the email in the URL.
 */
router.get("/reports/download/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const { email: rawEmail, sig, exp: rawExp } = req.query;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const expMs = typeof rawExp === "string" ? parseInt(rawExp, 10) : NaN;

  if (!email || typeof sig !== "string" || Number.isNaN(expMs)) {
    res.status(403).json({ error: "Invalid download link" });
    return;
  }

  // 1. Verify expiry
  if (Date.now() > expMs) {
    res.status(403).json({ error: "Download link has expired — reply to your welcome email to get a new one" });
    return;
  }

  // 2. Verify HMAC (timing-safe)
  let expected: string;
  try {
    expected = signMemberSlug(email, slug, expMs);
  } catch {
    res.status(500).json({ error: "Server misconfiguration" });
    return;
  }
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    res.status(403).json({ error: "Invalid download link" });
    return;
  }

  // 3. Entitlement check: email must belong to a founding member. That's it —
  //    the Special Reports were sold as "yours to keep even if you cancel",
  //    so we deliberately do NOT check subscription status here (unlike the
  //    paid-Wire path). Keeping report access also nudges canceled members
  //    to resubscribe.
  const [member] = await db
    .select({ plan: membersTable.plan })
    .from(membersTable)
    .where(
      and(
        eq(membersTable.email, email),
        sql`${membersTable.plan} IN ('founding-individual', 'founding-team')`,
      ),
    );
  if (!member) {
    res.status(403).json({ error: "Access restricted to Founding Members" });
    return;
  }
  // 4. Look up the report file
  const [report] = await db
    .select()
    .from(specialReportsTable)
    .where(eq(specialReportsTable.slug, slug));
  if (!report || !report.objectPath) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  // 5. Stream from GCS
  try {
    const file = await storageService.getObjectEntityFile(report.objectPath);
    const response = await storageService.downloadObject(file, 86400);

    res.setHeader("Content-Type", response.headers.get("Content-Type") ?? "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${slug}.pdf"`);
    const ct = response.headers.get("Content-Length");
    if (ct) res.setHeader("Content-Length", ct);
    res.setHeader("Cache-Control", "private, no-store");

    if (response.body) {
      const { Readable } = await import("node:stream");
      Readable.fromWeb(response.body as import("stream/web").ReadableStream).pipe(res);
    } else {
      res.status(500).end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      logger.warn({ slug }, "reports: file not found in GCS");
      res.status(404).json({ error: "Report not available" });
    } else {
      logger.error({ err, slug }, "reports: download failed");
      res.status(502).json({ error: "Download failed" });
    }
  }
});

export default router;
