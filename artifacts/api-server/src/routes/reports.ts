import { Router, type IRouter } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db, specialReportsTable, membersTable, paidWireSendsTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { logger } from "../lib/logger";
import { resendRequest } from "../lib/resend";
import { FROM_ADDRESS, SITE_URL } from "../lib/emailSequence";
import { entitledToNewPaidContent } from "../lib/entitlement";

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
 * to founding members can download. Special Reports are the founding member's
 * to keep: cancellation does NOT revoke download access (publisher policy —
 * the offer says "yours to keep").
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
 * Long-lived "remember me" session for the Shelf.
 *
 * When a member opens their signed Shelf link once, we set an HttpOnly
 * cookie so every later visit to /shelf just works — no link needed.
 * The cookie value is `email|hmac("shelf-session-v1:" + email)`, i.e. the
 * same secret-keyed HMAC scheme as the links themselves. Revocation story
 * matches the links: membership is checked on every request, so a removed
 * member loses access immediately even with a valid cookie.
 */
export const SHELF_COOKIE = "hsw_shelf";
const SHELF_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

export function shelfSessionValue(email: string): string {
  const e = email.toLowerCase();
  return `${e}|${hmac(`shelf-session-v1:${e}`)}`;
}

/** Returns the email if the cookie is valid, else null. */
export function verifyShelfSession(cookieValue: unknown): string | null {
  if (typeof cookieValue !== "string") return null;
  const idx = cookieValue.lastIndexOf("|");
  if (idx <= 0) return null;
  const email = cookieValue.slice(0, idx).toLowerCase();
  const sig = cookieValue.slice(idx + 1);
  try {
    return timingSafeMatch(sig, hmac(`shelf-session-v1:${email}`)) ? email : null;
  } catch {
    return null;
  }
}

export function shelfCookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    maxAge: SHELF_COOKIE_MAX_AGE_MS,
    path: "/",
  };
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

  // 3. Entitlement check: email must belong to a member — ANY plan (publisher
  //    policy, Aug 2026: the Special Reports are included for every member).
  //    The reports are "yours to keep even if you cancel", so we deliberately
  //    do NOT check subscription status here (unlike the paid-Wire path).
  //    Keeping report access also nudges canceled members to resubscribe.
  const [member] = await db
    .select({ plan: membersTable.plan })
    .from(membersTable)
    .where(eq(membersTable.email, email));
  if (!member) {
    res.status(403).json({ error: "Access restricted to members" });
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
    // Inline: the report opens readable in the browser (publisher preference,
    // Aug 2026) — members can save it from the viewer if they like.
    res.setHeader("Content-Disposition", `inline; filename="${slug}.pdf"`);
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
 * The member's "Shelf": their Special Reports (all plans) and every
 * weekly Wire issue that was sent to them. Membership-window scoping falls
 * out naturally from `recipientEmails`: an issue appears on a member's Shelf
 * iff their email was in the frozen recipient snapshot of that send — so a
 * canceled member keeps exactly what was sent while they were a member.
 */
router.get("/shelf", async (req, res): Promise<void> => {
  const { email: rawEmail, sig } = req.query;
  let email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (email && typeof sig === "string" && verifyShelfSig(email, sig)) {
    // Signed link — remember this browser so future visits need no link.
    res.cookie(SHELF_COOKIE, shelfSessionValue(email), shelfCookieOptions());
  } else {
    // No (valid) link — fall back to the remember-me cookie.
    const fromCookie = verifyShelfSession(req.cookies?.[SHELF_COOKIE]);
    if (!fromCookie) {
      res.status(403).json({ error: email || sig ? "Invalid Shelf link" : "Not signed in" });
      return;
    }
    email = fromCookie;
  }

  const [member] = await db
    .select({ plan: membersTable.plan, stripeSubscriptionId: membersTable.stripeSubscriptionId })
    .from(membersTable)
    .where(eq(membersTable.email, email));
  if (!member) {
    res.status(403).json({ error: "No membership found for this link" });
    return;
  }

  // Special Reports are included for every member (all plans).
  const isFounding = member.plan === "founding-individual" || member.plan === "founding-team";
  const rows = await db.select().from(specialReportsTable);
  const reports = rows
    .filter((r) => r.objectPath)
    .map((r) => ({ slug: r.slug, title: r.title, url: reportDownloadUrl(email, r.slug, "") }));

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

  // New members joined mid-week haven't received an issue yet — show them the
  // latest HSW Weekly Wire anyway (publisher policy, Aug 2026: the welcome
  // email links here for "the latest issue"). Gated: only CURRENTLY entitled
  // members (same rule as the weekly paid send — no sub id means comp/one-time,
  // still entitled), and only a finalized ("sent") issue. Canceled members'
  // historical access stays scoped by their recipientEmails snapshots above.
  if (sends.length === 0) {
    if (await entitledToNewPaidContent(member.stripeSubscriptionId)) {
      const [latest] = await db
        .select({
          weekKey: paidWireSendsTable.weekKey,
          subject: paidWireSendsTable.subject,
          bodyText: paidWireSendsTable.bodyText,
          sentAt: paidWireSendsTable.sentAt,
        })
        .from(paidWireSendsTable)
        .where(eq(paidWireSendsTable.status, "sent"))
        .orderBy(sql`${paidWireSendsTable.weekKey} desc`)
        .limit(1);
      if (latest) sends.push(latest);
    }
  }

  res.json({ plan: member.plan, isFounding, reports, issues: sends });
});

/**
 * POST /shelf/request-link  { email }
 *
 * Self-serve "email me my link": if the email belongs to a member, we email
 * them their permanent signed Shelf link. Always responds with a generic
 * success so the endpoint can't be used to probe which emails are members.
 * An hourly Resend Idempotency-Key caps sends to one email per address per
 * hour, so the public form can't be abused to spam a member's inbox.
 */
// Lightweight in-memory throttle for the public link-mailer: per-IP and
// global caps per hour. Resets on process restart, which is fine — the goal
// is stopping bulk abuse (mass-mailing members from a script), not perfect
// accounting. Resend's per-address Idempotency-Key already caps duplicates.
const requestLinkHits = new Map<string, { count: number; windowStart: number }>();
const REQUEST_LINK_WINDOW_MS = 60 * 60 * 1000;
const REQUEST_LINK_PER_IP = 10;
const REQUEST_LINK_GLOBAL = 100;

function requestLinkAllowed(ip: string): boolean {
  const now = Date.now();
  for (const scope of [`ip:${ip}`, "global"]) {
    const hit = requestLinkHits.get(scope);
    if (!hit || now - hit.windowStart > REQUEST_LINK_WINDOW_MS) {
      requestLinkHits.set(scope, { count: 1, windowStart: now });
      continue;
    }
    const cap = scope === "global" ? REQUEST_LINK_GLOBAL : REQUEST_LINK_PER_IP;
    if (hit.count >= cap) return false;
    hit.count += 1;
  }
  // Opportunistic cleanup so the map can't grow unbounded.
  if (requestLinkHits.size > 5000) {
    for (const [k, v] of requestLinkHits) {
      if (now - v.windowStart > REQUEST_LINK_WINDOW_MS) requestLinkHits.delete(k);
    }
  }
  return true;
}

router.post("/shelf/request-link", async (req, res): Promise<void> => {
  const raw = (req.body as { email?: unknown })?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const generic = {
    ok: true,
    message: "If that address has a membership, your private link is on its way.",
  };
  if (!email || !email.includes("@") || email.length > 320) {
    res.json(generic);
    return;
  }
  if (!requestLinkAllowed(req.ip ?? "unknown")) {
    logger.warn({ ip: req.ip }, "shelf request-link: rate limited");
    res.json(generic);
    return;
  }

  const [member] = await db
    .select({ email: membersTable.email })
    .from(membersTable)
    .where(eq(membersTable.email, email));
  if (!member) {
    logger.info({ email }, "shelf request-link: no membership for address");
    res.json(generic);
    return;
  }

  const link = shelfUrl(email, SITE_URL);
  const hourBucket = new Date().toISOString().slice(0, 13); // e.g. 2026-08-03T07
  try {
    await resendRequest("/emails", {
      method: "POST",
      headers: { "Idempotency-Key": `shelf-link-v1:${email}:${hourBucket}` },
      body: {
        from: FROM_ADDRESS,
        to: [email],
        subject: "Your HSW Shelf link",
        html:
          `<p>Here&#8217;s your private HSW Shelf link — every issue and report we've sent you, yours to keep:</p>` +
          `<p><a href="${link}">Open your HSW Shelf</a></p>` +
          `<p>Once you open it, this browser will remember you — next time, just visit ` +
          `<a href="${SITE_URL}/shelf">${SITE_URL.replace("https://", "")}/shelf</a>.</p>`,
      },
    });
    logger.info({ email }, "shelf request-link: link email sent");
  } catch (err) {
    // Don't leak membership existence via error responses.
    logger.error({ err, email }, "shelf request-link: send failed");
  }
  res.json(generic);
});

export default router;
