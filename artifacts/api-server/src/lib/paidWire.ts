/**
 * Core logic for the weekly paid-Wire send, kept free of Express/DB wiring so
 * the double-send and entitlement rules are unit-testable.
 */

/** Stripe subscription statuses that mean the member should NOT receive paid content. */
export const INACTIVE_SUB_STATUSES = [
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
] as const;

/**
 * Statuses Stripe itself still treats as a live subscription. Anything else,
 * including a missing row, is not active.
 */
export const ACTIVE_SUB_STATUSES = ["active", "trialing", "past_due"] as const;

export function isActiveStripeStatus(status: string): boolean {
  return (ACTIVE_SUB_STATUSES as readonly string[]).includes(status);
}

export interface PaidRecipient {
  id: number;
  email: string;
  stripeSubscriptionId: string | null;
}

export interface MemberForReconcile {
  id: number;
  email: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}

export interface StripeSubscriptionSnapshot {
  id: string;
  status: string;
  customerId: string | null;
}

export interface MembershipMismatch {
  email: string;
  kind: "missing_subscription_id" | "subscription_missing_in_stripe" | "inactive_stripe_status";
  detail: string;
}

/**
 * Members with a subscription in an inactive state are excluded. A member
 * with no Stripe subscription id is not active, including complimentary and
 * one-time rows. Returns recipients sorted by id so retry batches are
 * deterministic.
 */
export function activeRecipients(
  members: PaidRecipient[],
  inactiveSubscriptionIds: ReadonlySet<string>,
): PaidRecipient[] {
  return members
    .filter(
      (m) => Boolean(m.stripeSubscriptionId) && !inactiveSubscriptionIds.has(m.stripeSubscriptionId as string),
    )
    .sort((a, b) => a.id - b.id);
}

/**
 * Stripe's synced subscription rows are the source of truth. A local member
 * is active only when their subscription id is present and that row's status
 * is active, trialing, or past_due. Disagreements are returned for the
 * publisher alert; they are not guessed into the send list.
 */
export function reconcileMembers(
  members: MemberForReconcile[],
  subscriptions: StripeSubscriptionSnapshot[],
): { recipients: PaidRecipient[]; mismatches: MembershipMismatch[] } {
  const byId = new Map(subscriptions.map((sub) => [sub.id, sub]));
  const activeByCustomer = new Map<string, StripeSubscriptionSnapshot>();
  for (const sub of subscriptions) {
    if (sub.customerId && isActiveStripeStatus(sub.status)) activeByCustomer.set(sub.customerId, sub);
  }

  const mismatches: MembershipMismatch[] = [];
  const recipients: PaidRecipient[] = [];
  for (const member of members) {
    if (!member.stripeSubscriptionId) {
      const found = member.stripeCustomerId ? activeByCustomer.get(member.stripeCustomerId) : undefined;
      if (found) {
        mismatches.push({
          email: member.email,
          kind: "missing_subscription_id",
          detail: `Stripe subscription ${found.id} is ${found.status}, but the member row has no subscription id, so the Tuesday issue will not include them.`,
        });
      }
      continue;
    }
    const sub = byId.get(member.stripeSubscriptionId);
    if (!sub) {
      mismatches.push({
        email: member.email,
        kind: "subscription_missing_in_stripe",
        detail: `Subscription ${member.stripeSubscriptionId} is not in the synced Stripe table, so this member is not treated as active.`,
      });
      continue;
    }
    if (!isActiveStripeStatus(sub.status)) {
      mismatches.push({
        email: member.email,
        kind: "inactive_stripe_status",
        detail: `Stripe subscription ${sub.id} is ${sub.status}, so this member is not treated as active.`,
      });
      continue;
    }
    recipients.push({
      id: member.id,
      email: member.email,
      stripeSubscriptionId: member.stripeSubscriptionId,
    });
  }
  recipients.sort((a, b) => a.id - b.id);
  return { recipients, mismatches };
}

export function membershipMismatchDigest(mismatches: MembershipMismatch[]): string | null {
  if (mismatches.length === 0) return null;
  return mismatches
    .slice()
    .sort((a, b) => a.email.localeCompare(b.email) || a.kind.localeCompare(b.kind))
    .map((mismatch) => `${mismatch.email} [${mismatch.kind}]: ${mismatch.detail}`)
    .join("\n");
}

/**
 * Deterministic per-batch idempotency key, stable across retries of the same
 * weekly claim. Resend deduplicates on this key, so a retry after an
 * ambiguous network failure can never deliver a batch twice.
 */
export function batchIdempotencyKey(claimId: number, batchIndex: number): string {
  return `paid-wire-${claimId}-batch-${batchIndex}`;
}

export interface ClaimLike {
  status: string;
  recipientEmails: string[];
}

export type PaidSendPlan =
  | { action: "already-sent" }
  | { action: "resume" } // replay the stored snapshot; current entitlement is irrelevant
  | { action: "no-recipients" }
  | { action: "create" };

/**
 * Decide what a paid-send request should do. An existing in-flight claim is
 * ALWAYS resumed from its frozen snapshot — the current member list must not
 * be consulted, or a snapshot whose members later became inactive could be
 * permanently skipped after a genuine Resend failure.
 */
export function planPaidSend(
  existingClaim: ClaimLike | undefined,
  freshRecipientCount: number,
): PaidSendPlan {
  if (existingClaim) {
    return existingClaim.status === "sent" ? { action: "already-sent" } : { action: "resume" };
  }
  return freshRecipientCount === 0 ? { action: "no-recipients" } : { action: "create" };
}

export interface BatchEmail {
  from: string;
  to: string[];
  subject: string;
  html: string;
}

export interface SendOutcome {
  sent: number;
  failedEmails: string[];
}

/**
 * Chunk the claim's FROZEN email snapshot into batches of 100 (Resend's batch
 * limit) and send each with its stable idempotency key. The snapshot — never
 * a recomputed member list — must be passed in, so batch index i always maps
 * to the identical payload across retries. Errors are collected, never
 * rethrown — the caller decides how to report, and the claim is never released.
 */
export async function sendPaidWireBatches(opts: {
  claimId: number;
  emails: string[];
  buildEmail: (email: string) => BatchEmail;
  sendBatch: (emails: BatchEmail[], idempotencyKey: string) => Promise<void>;
  onBatchError?: (err: unknown, batchIndex: number) => void;
}): Promise<SendOutcome> {
  let sent = 0;
  const failedEmails: string[] = [];
  for (let i = 0; i * 100 < opts.emails.length; i++) {
    const chunk = opts.emails.slice(i * 100, i * 100 + 100);
    try {
      await opts.sendBatch(chunk.map(opts.buildEmail), batchIdempotencyKey(opts.claimId, i));
      sent += chunk.length;
    } catch (err) {
      opts.onBatchError?.(err, i);
      failedEmails.push(...chunk);
    }
  }
  return { sent, failedEmails };
}
