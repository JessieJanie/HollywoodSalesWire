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

export interface PaidRecipient {
  id: number;
  email: string;
  stripeSubscriptionId: string | null;
}

/**
 * Members with a subscription in an inactive state are excluded. Members with
 * no subscription id (e.g. one-time founding purchases) stay entitled.
 * Returns recipients sorted by id so retry batches are deterministic.
 */
export function activeRecipients(
  members: PaidRecipient[],
  inactiveSubscriptionIds: ReadonlySet<string>,
): PaidRecipient[] {
  return members
    .filter(
      (m) => !m.stripeSubscriptionId || !inactiveSubscriptionIds.has(m.stripeSubscriptionId),
    )
    .sort((a, b) => a.id - b.id);
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
