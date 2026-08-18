import { eq, and, isNull, inArray, sql, desc } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import {
  db,
  membersTable,
  emailSubscribersTable,
  sequenceEmailsTable,
  specialReportsTable,
  weeklyPreviewsTable,
} from "@workspace/db";
import { resendRequest } from "./resend";
import { FROM_ADDRESS, SITE_URL } from "./emailSequence";
import { reportDownloadUrl, shelfUrl } from "../routes/reports";
import { logger } from "./logger";

const NOTIFY_EMAIL = "hello@hollywoodsaleswire.com";

const REPORT_SLUGS = [
  { slug: "spend-map", title: "Under the Hood: The WBD AI Buildout" },
  { slug: "greenlight-window", title: "The $6.6 Billion Greenlight Window" },
  { slug: "requisition-read", title: "Help-Wanted Pages Are Purchase Orders" },
] as const;

const VALID_PLANS = new Set([
  "founding-individual",
  "founding-team",
  "individual",
  "team",
  "member",
]);

/**
 * Server-side mapping of known Stripe payment link IDs to plan labels.
 * These are the live payment link IDs for hollywoodsaleswire.com, set once
 * when the payment links were created. The same IDs are also stored in
 * metadata.plan on each link (set via the Stripe API) so incoming checkout
 * sessions carry the plan name directly. This hardcoded map is a secondary
 * stable fallback that does not require the session to have expanded metadata.
 *
 * Cross-reference:
 *   plink_1Tyebb8TDFH4346h8N2L6T6W  →  buy.stripe.com/7sYeV70l5bT5bDz47t1VK04  (founding-individual)
 *   plink_1Tyebb8TDFH4346hhxbXDUyX  →  buy.stripe.com/5kQfZb2td4qD373dI31VK05  (founding-team)
 *   plink_1TyeTj8TDFH4346hT3eAICwp  →  buy.stripe.com/8x200dgk30anePL8nJ1VK02  (individual)
 *   plink_1TyeTj8TDFH4346hYySSS9GB  →  buy.stripe.com/9B69AN9VFf5hfTPgUf1VK03  (team)
 */
export const PAYMENT_LINK_TO_PLAN: ReadonlyMap<string, string> = new Map([
  ["plink_1Tyebb8TDFH4346h8N2L6T6W", "founding-individual"],
  ["plink_1Tyebb8TDFH4346hhxbXDUyX", "founding-team"],
  ["plink_1TyeTj8TDFH4346hT3eAICwp", "individual"],
  ["plink_1TyeTj8TDFH4346hYySSS9GB", "team"],
]);

/**
 * Comma-separated Stripe price IDs for each plan, read from env vars.
 * Configuring these allows the webhook to identify the plan from a stable
 * price identifier rather than the charged amount (which varies with taxes and
 * discounts). Set FOUNDING_INDIVIDUAL_PRICE_IDS, FOUNDING_TEAM_PRICE_IDS,
 * INDIVIDUAL_PRICE_IDS, TEAM_PRICE_IDS as comma-separated price ID lists.
 */
function buildPriceIdMap(): Map<string, string> {
  const map = new Map<string, string>();
  const planEnvs: [string, string][] = [
    ["founding-individual", "FOUNDING_INDIVIDUAL_PRICE_IDS"],
    ["founding-team", "FOUNDING_TEAM_PRICE_IDS"],
    ["individual", "INDIVIDUAL_PRICE_IDS"],
    ["team", "TEAM_PRICE_IDS"],
  ];
  for (const [plan, envKey] of planEnvs) {
    const raw = process.env[envKey] ?? "";
    for (const id of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
      map.set(id, plan);
    }
  }
  return map;
}

// Build once at module load; process.env values are set before the server starts.
const PRICE_ID_TO_PLAN = buildPriceIdMap();

/**
 * Determine the subscription plan from a checkout session using stable
 * Stripe identifiers, in order of precedence:
 *
 * 1. `session.metadata.plan` — explicit plan tag set on the payment link.
 *    Most reliable: immune to pricing changes, taxes, and discounts.
 *    All four HSW payment links now have this set via the Stripe API.
 *
 * 2. `session.payment_link` ID matched against PAYMENT_LINK_TO_PLAN —
 *    hardcoded map of the known live payment link IDs. Stable across
 *    tax/discount and requires no session expansion; works even if the
 *    metadata.plan key is missing from an older payment link.
 *
 * 3. Line item price IDs mapped via FOUNDING_INDIVIDUAL_PRICE_IDS /
 *    FOUNDING_TEAM_PRICE_IDS / INDIVIDUAL_PRICE_IDS / TEAM_PRICE_IDS env vars
 *    (comma-separated). Stable across tax/discount; requires env config.
 *
 * 4. `amount_total` — last-resort fallback. Logs a warning because taxes or
 *    promotions can change the total and mis-classify a Founding member.
 *
 * @returns a plan string ("founding-individual", "founding-team",
 *   "individual", "team", or "member").
 */
export function planFromSession(session: CheckoutSessionLike): string {
  // 1. Explicit metadata tag on the payment link (set on all HSW links).
  const metaPlan = session.metadata?.plan?.trim().toLowerCase();
  if (metaPlan && VALID_PLANS.has(metaPlan)) {
    return metaPlan;
  }

  // 2. Known payment link ID → plan (hardcoded server-side, no expansion needed).
  const paymentLinkId = typeof session.payment_link === "string" ? session.payment_link : null;
  if (paymentLinkId) {
    const fromLink = PAYMENT_LINK_TO_PLAN.get(paymentLinkId);
    if (fromLink) return fromLink;
  }

  // 3. Price ID matching via env-configured lists.
  if (PRICE_ID_TO_PLAN.size > 0) {
    for (const item of session.line_items?.data ?? []) {
      const priceId = typeof item.price === "string" ? item.price : (item.price?.id ?? "");
      const matched = PRICE_ID_TO_PLAN.get(priceId);
      if (matched) return matched;
    }
  }

  // 4. Amount-total last resort — warns so the operator knows to configure.
  logger.warn(
    { amountCents: session.amount_total, paymentLink: paymentLinkId },
    "stripe: plan detected from amount_total (fallback); set metadata.plan on payment link or add link ID to PAYMENT_LINK_TO_PLAN",
  );
  return planFromAmount(session.amount_total);
}

/** Legacy amount-based detection, used only as planFromSession fallback. */
function planFromAmount(amountCents: number | null | undefined): string {
  switch (amountCents) {
    case 199500:
      return "founding-individual";
    case 499500:
      return "founding-team";
    case 399500:
      return "individual";
    case 999500:
      return "team";
    default:
      return "member";
  }
}

function planLabel(plan: string): string {
  switch (plan) {
    case "founding-individual":
      return "Founding Member — Individual ($1,995/yr)";
    case "founding-team":
      return "Founding Member — Team ($4,995/yr)";
    case "individual":
      return "Member — Individual ($3,995/yr)";
    case "team":
      return "Member — Team ($9,995/yr)";
    default:
      return "Member";
  }
}

export function isFoundingPlan(plan: string): boolean {
  return plan === "founding-individual" || plan === "founding-team";
}

/**
 * NEW-MEMBER WELCOME EMAIL — transactional copy, flagged for the publisher's
 * review (publisher-locked policy). Deliberately plain and claim-free.
 */
/** One-line descriptions for the welcome email, keyed by slug. */
const WELCOME_REPORT_DESCRIPTIONS: Record<string, string> = {
  "spend-map":
    "How Warner Bros. Discovery is actually building its AI capability, 8,700 miles from Burbank — who is hired, where, at what cost, and for what work, drawn from job postings, government records, corporate filings, and salary data on two continents. Not a scandal; a map.",
  "greenlight-window":
    "The state-by-state award-list calendar and the spend window when a production does nearly all of its buying — so you arrive while the budget is still being spent, not after.",
  "requisition-read":
    "Careers pages as disclosure documents: the job-title tells, the posting patterns that reveal a buildout weeks before any purchase order, and a full named walkthrough of a nine-figure streaming-sports buildout.",
};

function foundingRateLockHtml(amountCents: number | null): string {
  const p = (s: string) => `<p>${s}</p>`;
  const h = (s: string) =>
    `<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;margin:32px 0 12px;">${s}</p>`;
  // Derive annual and weekly display from the actual checkout amount so this
  // is always accurate regardless of plan variant or future pricing changes.
  let rateHtml: string;
  if (amountCents && amountCents > 0) {
    const annual = (amountCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const weekly = Math.round(amountCents / 52 / 100);
    rateHtml = `${p(`Your Founding Member rate is <strong>$${weekly} a week (${annual} a year, billed annually)</strong>. This rate is locked for the life of your membership — it will never increase as long as you remain a member. When Hollywood Sales Wire raises prices for new members, your rate stays exactly where it is today.`)}`;
  } else {
    rateHtml = `${p("Your Founding Member rate is locked for the life of your membership — it will never increase as long as you remain a member. When Hollywood Sales Wire raises prices for new members, your rate stays exactly where it is today.")}`;
  }
  return `${h("Your Founding Member rate — locked for life")}${rateHtml}`;
}

function welcomeHtml(
  email: string,
  firstName: string | null,
  reports: Array<{ slug: string; title: string }> | null,
  plan: string | null,
  amountCents: number | null,
): string {
  const p = (s: string) => `<p>${s}</p>`;
  const h = (s: string) =>
    `<p style="font-family:Arial,sans-serif;font-size:12px;letter-spacing:2px;color:#8a8577;text-transform:uppercase;margin:32px 0 12px;">${s}</p>`;
  const shelfLink = shelfUrl(email, SITE_URL);
  const greeting = firstName ? `Hello ${escapeHtml(firstName)},` : "Hello,";

  // Special Reports section — identical for every plan (publisher policy,
  // Aug 2026: all members receive the three Special Reports). Links open the
  // report readable in the browser (inline PDF); members can save from there.
  const reportsSection = reports
    ? `${h("Your three free Special Reports")}
      ${p("These are free with your membership. They are not for sale separately, and they never will be — they are for members only.")}
      <ul style="padding-left:20px;margin:24px 0;">
        ${reports
          .map(
            (r) =>
              `<li style="margin:12px 0;"><a href="${reportDownloadUrl(email, r.slug, SITE_URL)}" style="color:#1d5c3a;font-weight:bold;">${r.title}</a>${
                WELCOME_REPORT_DESCRIPTIONS[r.slug] ? ` — ${WELCOME_REPORT_DESCRIPTIONS[r.slug]}` : ""
              }</li>`,
          )
          .join("\n")}
      </ul>
      ${p("These links never expire and will also continue to be available to you on the website on your HSW Shelf.")}`
    : `${h("Your three free Special Reports")}
      ${p("These are free with your membership. They are not for sale separately, and they never will be — they are for members only. They'll arrive in a separate email as soon as they're ready, and they'll also be available on the website on your HSW Shelf.")}`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      ${p(greeting)}
      ${p("Thank you for choosing Hollywood Sales Wire, and welcome. Your membership is now active, and everything that comes with your subscription is below.")}
      ${plan?.startsWith("founding") ? foundingRateLockHtml(amountCents) : ""}
      ${reportsSection}
      ${h("The latest issue of the HSW Weekly Wire")}
      ${p(`<a href="${shelfLink}" style="color:#1d5c3a;font-weight:bold;">Click here</a> for the latest issue of the HSW Weekly Wire. Your subscription will actually start with next Tuesday's issue. It will arrive in your inbox here as well.`)}
      ${h("Your account")}
      ${p(`Everything above is stored on your <a href="${shelfLink}" style="color:#1d5c3a;font-weight:bold;">HSW Shelf</a>, with new HSW Weekly Wire issues automatically added every week. Both the Special Reports and every HSW Weekly Wire issue you receive are stored here for your convenience. Sign in any time with this email address. Past issues stay here too, so you never have to dig through your inbox for anything.`)}
      ${h("What happens next")}
      ${p("Every Tuesday your issue of the HSW Weekly Wire arrives in this inbox: the latest week's production spending signals, entity formations, and hiring tells — read, sorted, and turned into calls you can make the same day. Nothing to remember, nothing to log in for — and your HSW Shelf is always there with everything you've received to date, for easy reference.")}
      ${h("Getting the most from your first hour")}
      ${p("Start with the Special Reports — they review the reading method the Wire uses every week, to help you evaluate each issue with full context. Then, review the above HSW Weekly Wire for your latest hot leads – the ones closest to your territory and map out your strategies.")}
      ${p("One more thing: reply to this email any time — it reaches me directly. If a report raises a question, or an issue points somewhere you'd like more information on, please don't hesitate to let me know. This is your service, and your suggestions will help shape it going forward.")}
      ${p("Warm regards,")}
      ${p("Karilyn Colegrove,<br />Publisher, Hollywood Sales Wire")}
      ${p("P.S. One habit worth building from week one: read Tuesday's issue on Tuesday. The leads in it are live — the window on some of them closes within a week or two of the award date. The Wire earns its keep fastest when it's read the day it arrives.")}
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; <a href="${SITE_URL}" style="color:#8a8577;">hollywoodsaleswire.com</a><br />
        This is a receipt-of-membership email for your subscription.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * SPECIAL REPORTS catch-up email — sent to any member whose reports were not included in their welcome email (PDFs uploaded later).
 * Only sent when all three reports are uploaded.
 *
 * Download links are permanent bearer URLs (HMAC-signed, never expire —
 * publisher policy: "yours to keep", no re-issuing admin). They are not
 * session-authenticated. The founding-member entitlement check on the server
 * verifies the email encoded in the link still belongs to an active founding
 * member at download time.
 */
function specialReportsHtml(
  email: string,
  reports: Array<{ slug: string; title: string }>,
): string {
  const links = reports
    .map(
      (r) =>
        `<li style="margin:12px 0;"><a href="${reportDownloadUrl(email, r.slug, SITE_URL)}" style="color:#1d5c3a;font-weight:bold;">${r.title}</a></li>`,
    )
    .join("\n");
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f6f5f2;">
    <div style="max-width:560px;margin:0 auto;padding:32px 24px;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;font-size:17px;line-height:1.6;background:#ffffff;">
      <p>Your three Special Reports are ready. Click any title to download:</p>
      <ul style="padding-left:20px;margin:24px 0;">
        ${links}
      </ul>
      <p>These links are yours and never expire — the reports are yours to keep. They also live on your HSW Shelf, linked in your welcome email.</p>
      <p>Karilyn Colegrove, Publisher<br />Hollywood Sales Wire</p>
      <hr style="border:none;border-top:1px solid #e5e2da;margin:32px 0 16px;" />
      <p style="font-size:12px;color:#8a8577;font-family:Arial,sans-serif;">
        Hollywood Sales Wire &middot; <a href="${SITE_URL}" style="color:#8a8577;">hollywoodsaleswire.com</a>
      </p>
    </div>
  </body>
</html>`;
}

/**
 * Query the DB and return the three required reports in canonical order, only
 * if ALL three have been uploaded. Returns null if any required report is missing.
 * Restricts to the exact required slug set — extra rows are ignored.
 */
async function loadAllRequiredReports(): Promise<
  Array<{ slug: string; title: string }> | null
> {
  // Only query the exact required slugs — never treat extra DB rows as sufficient
  const requiredSlugs = REPORT_SLUGS.map((r) => r.slug as string);
  const rows = await db
    .select({ slug: specialReportsTable.slug, objectPath: specialReportsTable.objectPath })
    .from(specialReportsTable)
    .where(
      and(
        inArray(specialReportsTable.slug, requiredSlugs),
        sql`${specialReportsTable.objectPath} IS NOT NULL`,
      ),
    );
  // Build a map of uploaded required slugs
  const uploadedMap = new Map(rows.map((r) => [r.slug, r]));
  // All three required slugs must be present and uploaded
  const allPresent = REPORT_SLUGS.every((def) => uploadedMap.has(def.slug));
  if (!allPresent) return null;
  // Return in the canonical order defined by REPORT_SLUGS
  return REPORT_SLUGS.map((def) => ({ slug: def.slug, title: def.title }));
}

/**
 * Atomically claim report delivery for a member identified by email.
 *
 * Two-state outbox:
 *   specialReportsSentAt   = lease claim timestamp (set here, cleared on failure)
 *   specialReportsDeliveredAt = confirmed delivery (set only after Resend accepts)
 *
 * Claims only when BOTH are NULL so a stale-lease reset (sentAt = NULL while
 * deliveredAt remains NULL) can be re-claimed without re-delivering.
 * Returns the member id if we won the claim, null if already claimed/delivered.
 */
async function claimReportDeliveryByEmail(byEmail: string): Promise<number | null> {
  const claimed = await db
    .update(membersTable)
    .set({ specialReportsSentAt: new Date() })
    .where(
      and(
        eq(membersTable.email, byEmail),
        isNull(membersTable.specialReportsSentAt),
        isNull(membersTable.specialReportsDeliveredAt),
      ),
    )
    .returning({ id: membersTable.id });
  return claimed[0]?.id ?? null;
}

/**
 * Atomically claim report delivery for a member identified by numeric id.
 */
async function claimReportDeliveryById(memberId: number): Promise<number | null> {
  const claimed = await db
    .update(membersTable)
    .set({ specialReportsSentAt: new Date() })
    .where(
      and(
        eq(membersTable.id, memberId),
        isNull(membersTable.specialReportsSentAt),
        isNull(membersTable.specialReportsDeliveredAt),
      ),
    )
    .returning({ id: membersTable.id });
  return claimed[0]?.id ?? null;
}

/**
 * Confirm delivery: set deliveredAt ONLY after Resend accepts the email.
 * This is the "sent" marker; sentAt stays as the lease timestamp for auditing.
 */
async function confirmReportDelivery(memberId: number): Promise<void> {
  await db
    .update(membersTable)
    .set({ specialReportsDeliveredAt: new Date() })
    .where(eq(membersTable.id, memberId));
}

/**
 * Reset stale leases for members whose claim is older than the lease
 * window but whose delivery was never confirmed. Called by the scheduler before
 * each retry pass so process-crash stranded claims are recovered automatically.
 */
export async function resetStaleReportLeases(leaseTtlMs = 15 * 60 * 1000): Promise<number> {
  const staleBefore = new Date(Date.now() - leaseTtlMs);
  const reset = await db
    .update(membersTable)
    .set({ specialReportsSentAt: null })
    .where(
      and(
        sql`${membersTable.specialReportsSentAt} IS NOT NULL`,
        isNull(membersTable.specialReportsDeliveredAt),
        sql`${membersTable.specialReportsSentAt} < ${staleBefore.toISOString()}`,
      ),
    )
    .returning({ id: membersTable.id });
  if (reset.length > 0) {
    logger.warn({ count: reset.length }, "special-reports: reset stale delivery leases");
  }
  return reset.length;
}

/**
 * Send Special Reports catch-up email to a member.
 *
 * Delivery protocol:
 * 1. `loadAllRequiredReports` — bail if PDFs not all uploaded yet.
 * 2. Atomic claim (`sentAt = NOW()`) — bail if already claimed/delivered.
 * 3. Call Resend with a deterministic idempotency key.
 * 4. On success: set `deliveredAt = NOW()` (confirmed).
 * 5. On failure: lease is held (NOT released). The stale-lease TTL (15 min)
 *    recovers it automatically, and Resend's idempotency key (24 h retention)
 *    deduplicates any ambiguous accepted request within that window.
 *    This avoids a race where releasing immediately + retrying after the
 *    idempotency window could re-deliver an already-accepted email.
 *
 * Returns true if sent, false if skipped (already delivered or PDFs missing).
 */
export async function sendSpecialReportsToMember(email: string): Promise<boolean> {
  const reports = await loadAllRequiredReports();
  if (!reports) {
    logger.info({ email }, "special-reports: not all required reports uploaded yet — skipping");
    return false;
  }

  const claimedId = await claimReportDeliveryByEmail(email);
  if (!claimedId) {
    logger.info({ email }, "special-reports: already delivered or claimed — skipping");
    return false;
  }

  const idempotencyKey = createHash("sha256")
    .update(`special-reports-v1:${email.toLowerCase()}`)
    .digest("hex");

  // On error: do NOT release the lease — stale-lease recovery (15 min) retries,
  // and Resend's idempotency key prevents duplicate delivery within 24 h.
  await resendRequest("/emails", {
    method: "POST",
    body: {
      from: FROM_ADDRESS,
      to: [email],
      subject: "Your Hollywood Sales Wire Special Reports",
      html: specialReportsHtml(email, reports),
    },
    headers: { "Idempotency-Key": idempotencyKey },
  });

  await confirmReportDelivery(claimedId);
  logger.info({ email }, "special-reports: delivered to member");
  return true;
}

/**
 * Deliver reports to ALL members (any plan) who have not received them yet.
 *
 * Queries by `deliveredAt IS NULL` (not sentAt) so stale-lease-reset members
 * are included, and members with an active in-flight claim (sentAt NOT NULL)
 * are naturally skipped by the atomic claim step.
 *
 * Called from the checkout webhook and the scheduler retry tick.
 * Returns count of members successfully delivered to.
 */
export async function deliverReportsToPendingMembers(): Promise<number> {
  const reports = await loadAllRequiredReports();
  if (!reports) return 0;

  const pending = await db
    .select({ id: membersTable.id, email: membersTable.email })
    .from(membersTable)
    .where(isNull(membersTable.specialReportsDeliveredAt));

  let sent = 0;
  for (const member of pending) {
    const claimedId = await claimReportDeliveryById(member.id);
    if (!claimedId) continue;

    const idempotencyKey = createHash("sha256")
      .update(`special-reports-v1:${member.email.toLowerCase()}`)
      .digest("hex");

    try {
      // On error: do NOT release the lease — stale-lease recovery (15 min) retries,
      // and Resend's idempotency key prevents duplicate delivery within 24 h.
      await resendRequest("/emails", {
        method: "POST",
        body: {
          from: FROM_ADDRESS,
          to: [member.email],
          subject: "Your Hollywood Sales Wire Special Reports",
          html: specialReportsHtml(member.email, reports),
        },
        headers: { "Idempotency-Key": idempotencyKey },
      });
      await confirmReportDelivery(claimedId);
      sent++;
      logger.info({ email: member.email }, "special-reports: delivered (retroactive)");
    } catch (err) {
      logger.error({ err, email: member.email }, "special-reports: delivery failed — stale-lease recovery will retry in ≤15 min");
    }
  }
  return sent;
}

/**
 * When a member's subscription is fully canceled, move them onto the free
 * weekly newsletter list (publisher policy, Aug 2026): the Free Edition keeps
 * HSW in their inbox and encourages resubscribing. Rules:
 * - Insert as an active free subscriber if they're not on the list.
 * - If they previously UNSUBSCRIBED from the free list, respect that — do
 *   not re-activate them (consent).
 * - Never (re)start the founding-offer sales series — they're ex-members,
 *   not prospects; only the weekly Free Edition applies.
 * - Idempotent and non-fatal: Stripe may retry; failures are logged only.
 */
async function handleSubscriptionCanceled(object: unknown): Promise<void> {
  const sub = (object ?? {}) as { id?: string };
  if (!sub.id) return;
  try {
    const [member] = await db
      .select({ email: membersTable.email })
      .from(membersTable)
      .where(eq(membersTable.stripeSubscriptionId, sub.id));
    if (!member) {
      logger.warn({ subscriptionId: sub.id }, "stripe: canceled subscription has no member row");
      return;
    }
    const token = randomBytes(24).toString("hex");
    const inserted = await db
      .insert(emailSubscribersTable)
      .values({ email: member.email, unsubscribeToken: token })
      .onConflictDoNothing({ target: emailSubscribersTable.email })
      .returning({ id: emailSubscribersTable.id });
    logger.info(
      { email: member.email, addedToFreeList: inserted.length > 0 },
      "stripe: member subscription canceled — free-newsletter handoff",
    );
  } catch (err) {
    logger.error({ err, subscriptionId: sub.id }, "stripe: free-newsletter handoff failed");
  }
}

interface CheckoutSessionLineItem {
  price?: string | { id?: string } | null;
}

/**
 * Send the single unified welcome email (publisher policy, Aug 2026): one
 * email for EVERY plan containing the welcome copy, the three Special Report
 * download links (when all PDFs are uploaded), and the latest Wire issue
 * (when fresh). No plan-conditional wording.
 *
 * Report delivery is claimed atomically before sending so the scheduler's
 * catch-up pass never sends a duplicate reports email; on failure the claim
 * is held and recovered by the stale-lease TTL (see sendSpecialReportsToMember).
 * Throws if the send fails (caller releases its welcome claim; the Resend
 * idempotency key prevents a duplicate welcome within 24 h).
 */
async function sendUnifiedWelcome(email: string): Promise<void> {
  let reports = await loadAllRequiredReports();
  let reportsClaimId: number | null = null;
  if (reports) {
    reportsClaimId = await claimReportDeliveryByEmail(email);
    if (!reportsClaimId) reports = null; // already delivered — don't repeat links
  }
  const [memberRow] = await db
    .select({ name: membersTable.name, plan: membersTable.plan, amountCents: membersTable.amountCents })
    .from(membersTable)
    .where(eq(membersTable.email, email));
  const firstName = memberRow?.name?.trim().split(/\s+/)[0] || null;
  const plan = memberRow?.plan ?? null;
  const amountCents = memberRow?.amountCents ?? null;

  // Deterministic idempotency key: Stripe webhook retries and welcome-claim
  // releases can re-invoke this — Resend dedupes for 24 h, so the member can
  // never receive the welcome email twice within that window.
  const idempotencyKey = createHash("sha256")
    .update(`welcome-v1:${email.toLowerCase()}`)
    .digest("hex");

  // On error: do NOT release the reports lease (same policy as the catch-up
  // sender): the stale-lease TTL (15 min) recovers it and the scheduler then
  // delivers the reports in a separate email. Worst case on an ambiguous
  // accepted request, the member gets the permanent links twice — harmless.
  await resendRequest("/emails", {
    method: "POST",
    body: {
      from: FROM_ADDRESS,
      to: [email],
      subject: "Welcome to Hollywood Sales Wire — your membership is active",
      html: welcomeHtml(email, firstName, reports, plan, amountCents),
    },
    headers: { "Idempotency-Key": idempotencyKey },
  });

  if (reportsClaimId) {
    // Confirm failure is non-fatal: the lease expires, the scheduler re-sends
    // the reports separately (duplicate permanent links — harmless), and we
    // must NOT bubble up, which would release the welcome claim and re-send
    // the whole welcome after the idempotency window.
    try {
      await confirmReportDelivery(reportsClaimId);
    } catch (err) {
      logger.error({ err, email }, "members: report delivery confirm failed — scheduler will re-send links");
    }
  }
}

/**
 * Create a complimentary (no-Stripe) member from the publisher console.
 * Mirrors the paid-member flow minus billing: upsert the member, send the
 * welcome email once (atomic claim), then Special Reports (founding plans)
 * and the latest Wire issue. Idempotent: re-adding an existing member never
 * re-sends the welcome email.
 */
export async function createCompMember(
  rawEmail: string,
  plan: string,
): Promise<{ created: boolean; welcomed: boolean }> {
  const email = rawEmail.trim().toLowerCase();
  const inserted = await db
    .insert(membersTable)
    .values({ email, plan })
    .onConflictDoUpdate({ target: membersTable.email, set: { plan: sql`excluded.plan` } })
    .returning({ id: membersTable.id, welcomeSentAt: membersTable.welcomeSentAt });
  logger.info({ email, plan }, "publisher: complimentary member recorded");

  const claimed = await db
    .update(membersTable)
    .set({ welcomeSentAt: new Date() })
    .where(and(eq(membersTable.email, email), isNull(membersTable.welcomeSentAt)))
    .returning({ id: membersTable.id });
  if (claimed.length === 0) {
    return { created: inserted.length > 0, welcomed: false };
  }

  try {
    await sendUnifiedWelcome(email);
  } catch (err) {
    logger.error({ err, email }, "publisher: failed to send comp-member welcome — releasing claim");
    await db
      .update(membersTable)
      .set({ welcomeSentAt: null })
      .where(eq(membersTable.email, email));
    throw err;
  }
  return { created: true, welcomed: true };
}

export interface CheckoutSessionLike {
  id?: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number | null;
  customer?: string | { id?: string } | null;
  subscription?: string | { id?: string } | null;
  customer_details?: { email?: string | null; name?: string | null } | null;
  /** Metadata set on the payment link — preferred for plan identification. */
  metadata?: Record<string, string> | null;
  /** The Stripe payment link ID (plink_xxx) that originated this session. */
  payment_link?: string | null;
  /** Line items expanded on the session (Stripe expand: ['line_items']). */
  line_items?: { data: CheckoutSessionLineItem[] } | null;
}

/**
 * Called for every verified Stripe webhook event (after stripe-replit-sync
 * has synced it). Records the member, stops the founding-offer sales series,
 * sends a one-time welcome email, optionally sends Special Reports to
 * Founding Members, and notifies the publisher.
 *
 * Retry/concurrency safety (Stripe retries + multiple autoscale instances):
 * - The member upsert is a single atomic INSERT … ON CONFLICT.
 * - Welcome + publisher notification are gated by an atomic claim on
 *   `welcome_sent_at` (UPDATE … WHERE welcome_sent_at IS NULL RETURNING), so
 *   exactly one delivery wins; the claim is released if sending fails so a
 *   later Stripe retry can try again.
 * - Throws on member-persistence failure so the route returns 500 and Stripe
 *   retries; email side-effect failures never throw.
 */
export async function handleStripeEvent(event: {
  type?: string;
  data?: { object?: unknown };
}): Promise<void> {
  if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionCanceled(event.data?.object);
    return;
  }
  if (event.type !== "checkout.session.completed") return;
  const session = (event.data?.object ?? {}) as CheckoutSessionLike;
  if (session.payment_status && session.payment_status !== "paid") return;

  const email = session.customer_details?.email?.trim().toLowerCase();
  if (!email) {
    logger.warn({ sessionId: session.id }, "stripe: checkout completed without an email");
    return;
  }

  const customerId =
    typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : (session.subscription?.id ?? null);
  const amountCents = session.amount_total ?? null;
  const plan = planFromSession(session);

  // Atomic upsert — if this throws, the caller returns 500 and Stripe retries.
  await db
    .insert(membersTable)
    .values({
      email,
      name: session.customer_details?.name?.trim() || null,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan,
      amountCents,
    })
    .onConflictDoUpdate({
      target: membersTable.email,
      set: {
        name: sql`coalesce(excluded.name, ${membersTable.name})`,
        stripeCustomerId: sql`coalesce(excluded.stripe_customer_id, ${membersTable.stripeCustomerId})`,
        stripeSubscriptionId: sql`coalesce(excluded.stripe_subscription_id, ${membersTable.stripeSubscriptionId})`,
        plan: sql`excluded.plan`,
        amountCents: sql`excluded.amount_cents`,
      },
    });

  logger.info({ email, plan }, "stripe: paid member recorded");

  // Atomically claim the one-time welcome/notification. Zero rows = another
  // delivery already claimed it (or it was already sent) — stop here.
  const claimed = await db
    .update(membersTable)
    .set({ welcomeSentAt: new Date() })
    .where(and(eq(membersTable.email, email), isNull(membersTable.welcomeSentAt)))
    .returning({ id: membersTable.id });
  if (claimed.length === 0) return;

  // Stop the founding-offer sales series — they already bought. Mark canceled
  // only when Resend confirms; a failed cancel stays "scheduled" in our books.
  try {
    const [subscriber] = await db
      .select()
      .from(emailSubscribersTable)
      .where(eq(emailSubscribersTable.email, email));
    if (subscriber) {
      const scheduled = await db
        .select()
        .from(sequenceEmailsTable)
        .where(eq(sequenceEmailsTable.subscriberId, subscriber.id));
      for (const item of scheduled) {
        if (item.status === "pending" || item.status === "scheduling") {
          await db
            .update(sequenceEmailsTable)
            .set({ status: "canceled" })
            .where(eq(sequenceEmailsTable.id, item.id));
          continue;
        }
        if (item.status === "scheduled" && item.resendEmailId) {
          try {
            await resendRequest(`/emails/${item.resendEmailId}/cancel`, { method: "POST" });
            await db
              .update(sequenceEmailsTable)
              .set({ status: "canceled" })
              .where(eq(sequenceEmailsTable.id, item.id));
          } catch (err) {
            logger.warn({ err, id: item.id }, "stripe: could not cancel scheduled sales email");
          }
        }
      }
    }
  } catch (err) {
    logger.error({ err, email }, "stripe: failed while canceling founding series");
  }

  // Unified welcome email (includes Special Report links + latest Wire).
  // If it fails, release the claim so a Stripe retry resends.
  try {
    await sendUnifiedWelcome(email);
  } catch (err) {
    logger.error({ err, email }, "stripe: failed to send member welcome email — releasing claim");
    try {
      await db
        .update(membersTable)
        .set({ welcomeSentAt: null })
        .where(eq(membersTable.email, email));
    } catch (releaseErr) {
      logger.error({ err: releaseErr, email }, "stripe: failed to release welcome claim");
    }
    return;
  }

  // Publisher notification.
  try {
    const reportsNote =
      " Their welcome email included the Special Report links (if all three are uploaded) — otherwise the reports go out automatically as soon as you upload the PDFs via your publisher console.";
    await resendRequest("/emails", {
      method: "POST",
      body: {
        from: FROM_ADDRESS,
        to: [NOTIFY_EMAIL],
        subject: `New paid member: ${email}`,
        html: `<p>A new member just subscribed via Stripe.</p><ul><li><strong>Email:</strong> ${email}</li><li><strong>Plan:</strong> ${planLabel(plan)}</li></ul><p>Their welcome email was sent automatically, and any pending founding-offer sales emails to them were canceled.${reportsNote}</p>`,
      },
    });
  } catch (err) {
    logger.error({ err, email }, "stripe: failed to send publisher notification");
  }
}
