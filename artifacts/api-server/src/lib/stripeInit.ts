import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import { logger } from "./logger";

/**
 * Initialize the Stripe sync layer: create the `stripe` schema, register the
 * managed webhook for this environment, and backfill existing Stripe data.
 * Failures are logged loudly but never crash the server — the site, signups,
 * and the Wire pipeline must keep working even if Stripe is unreachable.
 */
export async function initStripe(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.error("stripe init: DATABASE_URL is required — Stripe automation disabled");
    return;
  }

  try {
    await runMigrations({ databaseUrl });

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
    const webhook = await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`,
    );
    logger.info({ url: webhook?.url }, "stripe init: managed webhook ready");

    stripeSync
      .syncBackfill()
      .then(() => logger.info("stripe init: data backfill complete"))
      .catch((err) => logger.error({ err }, "stripe init: backfill failed"));
  } catch (err) {
    logger.error({ err }, "stripe init failed — new-member automation is NOT active");
  }
}
