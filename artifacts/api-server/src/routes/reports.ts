import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, specialReportsTable, membersTable, paidWireSendsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const storageService = new ObjectStorageService();

function hmac(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function timingSafeMatch(sig: string, expected: string): boolean {
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

/**
 * Compute a per-member, per-slug HMAC signature. Links are PERMANENT
 * (publisher policy, Aug 2026): the reports are "yours to keep", so links
 * never expire — no admin overhead of re-issuing links.
 *
 * The signature covers email + slug so the link cannot be re-targeted. The
 * email is in the URL (not in a session), so a link CAN be forwarded; the
 * founding-member entitlement check on the server means only emails belonging
 * to founding members can download.
 */
export function signMemberSlug(email: string, slug: string): string {
  return hmac(`report-download-v2:${email.toLowerCase()}:${slug}`);
}

/** Legacy (pre-Aug 2026) time-bound signature — kept so old emailed links keep working. */
function signMemberSlugLegacy(email: string, slug: string, expMs: number): string {
  return hmac(`report-download:${email.toLowerCase()}:${slug}:${expMs}`);
}

/**
 * Build a permanent download URL for a report.
 * Exported so members.ts can call it without importing the route module.
 */
export function reportDownloadUrl(email: string, slug: string, siteUrl: string): string {
  const sig = signMemberSlug(email, slug);
  return (
    `${siteUrl}/api/reports/download/${encodeURIComponent(slug)}` +
    `?email=${encodeURIComponent(email.toLowerCase())}&sig=${sig}`
  );
}

/** Permanent signed URL for a member's Shelf page (their reports + Wire archive). */
export function shelfUrl(email: string, siteUrl: string): string {
  const sig = hmac(`shelf-v1:${email.toLowerCase()}`);
  return `${siteUrl}/shelf?email=${encodeURIComponent(email.toLowerCase())}&sig=${sig}`;
}

export function verifyShelfSig(email: string, sig: string): boolean {
  try {
    return timingSafeMatch(sig, hmac(`shelf-v1:${email.toLowerCase()}`));
  } catch {
    return false;
  }
}

/**
 * GET /reports/download/:slug?email=<addr>&sig=<hmac>
 *
 * Permanent per-member download link (legacy links carry an extra `exp`
 * parameter and are verified against the old time-bound scheme, still
 * honoring their original expiry).
 */
router.get("/reports/download/:slug", async (req, res): Promise<void> => {
  const { slug } = req.params;
  const { email: rawEmail, sig, exp: rawExp } = req.query;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (!email || typeof sig !== "string") {
    res.status(403).json({ error: "Invalid download link" });
    return;
  }

  // Verify HMAC (timing-safe). Permanent links have no exp; legacy links do.
  try {
    if (typeof rawExp === "string") {
      const expMs = parseInt(rawExp, 10);
      if (Number.isNaN(expMs) || Date.now() > expMs) {
        res.status(403).json({ error: "Download link has expired — reply to your welcome email to get a new one" });
        return;
      }
      if (!timingSafeMatch(sig, signMemberSlugLegacy(email, slug, expMs))) {
        res.status(403).json({ error: "Invalid download link" });
        return;
      }
    } else if (!timingSafeMatch(sig, signMemberSlug(email, slug))) {
      res.status(403).json({ error: "Invalid download link" });
      return;
    }
  } catch {
    res.status(500).json({ error: "Server misconfiguration" });
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

/**
 * GET /shelf?email=<addr>&sig=<hmac>
 *
 * The member's "Shelf": their Special Reports (founding members) and every
 * weekly Wire issue that was sent to them. Membership-window scoping falls
 * out naturally from `recipientEmails`: an issue appears on a member's Shelf
 * iff their email was in the frozen recipient snapshot of that send — so a
 * canceled member keeps exactly what was sent while they were a member.
 */
router.get("/shelf", async (req, res): Promise<void> => {
  const { email: rawEmail, sig } = req.query;
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  if (!email || typeof sig !== "string" || !verifyShelfSig(email, sig)) {
    res.status(403).json({ error: "Invalid Shelf link" });
    return;
  }

  const [member] = await db
    .select({ plan: membersTable.plan })
    .from(membersTable)
    .where(eq(membersTable.email, email));
  if (!member) {
    res.status(403).json({ error: "No membership found for this link" });
    return;
  }

  const isFounding = member.plan === "founding-individual" || member.plan === "founding-team";
  let reports: Array<{ slug: string; title: string; url: string }> = [];
  if (isFounding) {
    const rows = await db.select().from(specialReportsTable);
    reports = rows
      .filter((r) => r.objectPath)
      .map((r) => ({ slug: r.slug, title: r.title, url: reportDownloadUrl(email, r.slug, "") }));
  }

  const sends = await db
    .select({
      weekKey: paidWireSendsTable.weekKey,
      subject: paidWireSendsTable.subject,
      bodyText: paidWireSendsTable.bodyText,
      sentAt: paidWireSendsTable.sentAt,
    })
    .from(paidWireSendsTable)
    .where(sql`${email} = any(${paidWireSendsTable.recipientEmails})`)
    .orderBy(sql`${paidWireSendsTable.weekKey} desc`);

  res.json({ plan: member.plan, isFounding, reports, issues: sends });
});

export default router;
