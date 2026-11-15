import { createHash } from "node:crypto";
import { runMigrations } from "stripe-replit-sync";
import type Stripe from "stripe";
import { getStripeClientContext, type StripeCredentialMode } from "./stripeClient";
import {
  EXPECTED_STRIPE_ACCOUNT_ID,
  EXPECTED_STRIPE_WEBHOOK_ID,
  EXPECTED_STRIPE_WEBHOOK_URL,
} from "./stripeConfig";
import { FROM_ADDRESS } from "./emailSequence";
import { logger } from "./logger";
import { resendRequest } from "./resend";

const OWNER_EMAIL = "hello@hollywoodsaleswire.com";

export type StripeWebhookVerification =
  | { ok: true; accountId: string }
  | { ok: false; accountId?: string; reason: string };

/**
 * Read-only verification. This deliberately uses only Stripe GET operations:
 * it never creates, updates, disables, or deletes webhook endpoints.
 */
export async function verifyExpectedStripeWebhook(
  stripe: Stripe,
  mode: StripeCredentialMode,
): Promise<StripeWebhookVerification> {
  if (mode !== "live") {
    return {
      ok: false,
      reason: `Expected a live Stripe connection, but the selected key mode is ${mode}.`,
    };
  }

  const account = await stripe.accounts.retrieve(null);
  if (account.id !== EXPECTED_STRIPE_ACCOUNT_ID) {
    return {
      ok: false,
      accountId: account.id,
      reason: `Expected live Stripe account ${EXPECTED_STRIPE_ACCOUNT_ID}, but connected account is ${account.id}.`,
    };
  }

  const webhook = await stripe.webhookEndpoints.retrieve(EXPECTED_STRIPE_WEBHOOK_ID);
  if (webhook.id !== EXPECTED_STRIPE_WEBHOOK_ID) {
    return {
      ok: false,
      accountId: account.id,
      reason: `Expected webhook ${EXPECTED_STRIPE_WEBHOOK_ID}, but Stripe returned ${webhook.id}.`,
    };
  }
  if (webhook.url !== EXPECTED_STRIPE_WEBHOOK_URL) {
    return {
      ok: false,
      accountId: account.id,
      reason: `Webhook ${webhook.id} URL mismatch: expected ${EXPECTED_STRIPE_WEBHOOK_URL}, found ${webhook.url}.`,
    };
  }
  if (webhook.status !== "enabled") {
    return {
      ok: false,
      accountId: account.id,
      reason: `Webhook ${webhook.id} is ${webhook.status}; expected enabled.`,
    };
  }

  return { ok: true, accountId: account.id };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Autoscale starts a fresh API instance on every cold start, and each start
 * runs this check. Resend keeps an idempotency key for 24 hours, so keying the
 * alert on the failure reason sends one email per distinct problem per day
 * instead of one per cold start.
 */
export function stripeAlertIdempotencyKey(reason: string): string {
  const fingerprint = createHash("sha256")
    .update(`${EXPECTED_STRIPE_ACCOUNT_ID}|${EXPECTED_STRIPE_WEBHOOK_ID}|${reason}`)
    .digest("hex")
    .slice(0, 32);
  return `stripe-webhook-verification-${fingerprint}`;
}

async function alertOwner(reason: string): Promise<void> {
  try {
    await resendRequest("/emails", {
      method: "POST",
      headers: { "Idempotency-Key": stripeAlertIdempotencyKey(reason) },
      body: {
        from: FROM_ADDRESS,
        to: [OWNER_EMAIL],
        subject: "Action needed: Stripe webhook verification failed",
        html: `<p>API startup could not verify the configured live Stripe webhook. No Stripe webhook changes were made.</p><p><strong>Expected account:</strong> ${EXPECTED_STRIPE_ACCOUNT_ID}<br /><strong>Expected endpoint:</strong> ${EXPECTED_STRIPE_WEBHOOK_ID}<br /><strong>Expected URL:</strong> ${EXPECTED_STRIPE_WEBHOOK_URL}</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p>`,
      },
    });
  } catch (err) {
    logger.error({ err }, "stripe init: failed to alert owner about webhook verification");
  }
}

/**
 * Initialize Stripe support without reconciling endpoints. Startup verifies
 * the expected live account and webhook using read-only retrieval calls.
 * Failures are logged and alerted but never trigger Stripe writes.
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    const reason = "DATABASE_URL is missing, so startup could not verify the Stripe webhook.";
    logger.warn({ expectedAccountId: EXPECTED_STRIPE_ACCOUNT_ID }, reason);
    await alertOwner(reason);
    return;
  }

  try {
    await runMigrations({ databaseUrl });

    const { stripe, mode } = await getStripeClientContext();
    const verification = await verifyExpectedStripeWebhook(stripe, mode);
    if (!verification.ok) {
      logger.warn(
        {
          expectedAccountId: EXPECTED_STRIPE_ACCOUNT_ID,
          actualAccountId: verification.accountId,
          expectedWebhookId: EXPECTED_STRIPE_WEBHOOK_ID,
          expectedWebhookUrl: EXPECTED_STRIPE_WEBHOOK_URL,
          reason: verification.reason,
        },
        "stripe init: read-only webhook verification failed; no Stripe changes made",
      );
      await alertOwner(verification.reason);
      return;
    }

    logger.info(
      {
        accountId: verification.accountId,
        webhookId: EXPECTED_STRIPE_WEBHOOK_ID,
        url: EXPECTED_STRIPE_WEBHOOK_URL,
      },
      "stripe init: expected live webhook verified",
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    logger.warn(
      {
        err,
        expectedAccountId: EXPECTED_STRIPE_ACCOUNT_ID,
        expectedWebhookId: EXPECTED_STRIPE_WEBHOOK_ID,
        expectedWebhookUrl: EXPECTED_STRIPE_WEBHOOK_URL,
      },
      "stripe init: read-only webhook verification failed; no Stripe changes made",
    );
    await alertOwner(reason);
  }
}
