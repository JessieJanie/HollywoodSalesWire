import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

export type StripeCredentialMode = "live" | "test" | "unknown";

function modeForKey(secretKey: string): StripeCredentialMode {
  if (/^(sk|rk)_live_/.test(secretKey)) return "live";
  if (/^(sk|rk)_test_/.test(secretKey)) return "test";
  return "unknown";
}

/**
 * Fetches Stripe credentials from the Replit connection API.
 * Not cached — tokens can rotate, so fetch fresh each time.
 */
/**
 * The live endpoint (we_…, see stripeConfig.ts) was created in the Stripe
 * Dashboard, so neither the Replit Stripe connector nor stripe-replit-sync's
 * managed-webhook table holds its signing secret. Its single source is the
 * STRIPE_WEBHOOK_SECRET app secret (Stripe Dashboard → Webhooks → endpoint →
 * Signing secret).
 */
export function getStripeWebhookSecret(): string | undefined {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return secret ? secret : undefined;
}

async function getStripeCredentials(): Promise<{ secretKey: string }> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "Missing Replit environment variables. " +
        "Ensure the Stripe integration is connected via the Integrations tab.",
    );
  }

  const resp = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=stripe`,
    {
      headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!resp.ok) {
    throw new Error(`Failed to fetch Stripe credentials: ${resp.status} ${resp.statusText}`);
  }

  const data = (await resp.json()) as {
    items?: Array<{
      settings?: { secret_key?: string; secret?: string };
    }>;
  };
  // This connection stores the key under `secret` (some store `secret_key`).
  // Multiple Stripe connections may exist; prefer the live-key connection.
  const keyOf = (s?: { secret_key?: string; secret?: string }) => s?.secret_key ?? s?.secret;
  const live = data.items?.find((i) => keyOf(i.settings)?.match(/^(sk|rk)_live/));
  const settings = live?.settings ?? data.items?.[0]?.settings;
  const secretKey = keyOf(settings);

  if (!secretKey) {
    throw new Error(
      "Stripe integration not connected or missing secret key. " +
        "Connect Stripe via the Integrations tab first.",
    );
  }

  return { secretKey };
}

/** Returns a fresh authenticated Stripe client (not cached; keys can rotate). */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const { stripe } = await getStripeClientContext();
  return stripe;
}

/** Returns a fresh client and its key mode for guarded, read-only checks. */
export async function getStripeClientContext(): Promise<{
  stripe: Stripe;
  mode: StripeCredentialMode;
}> {
  const { secretKey } = await getStripeCredentials();
  return { stripe: new Stripe(secretKey), mode: modeForKey(secretKey) };
}

/** Returns a fresh StripeSync instance for webhook processing and data sync. */
export async function getStripeSync(): Promise<StripeSync> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is required");
  }

  const webhookSecret = getStripeWebhookSecret();
  if (!webhookSecret) {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is not set, so Stripe webhook signatures cannot be verified.",
    );
  }

  const { secretKey } = await getStripeCredentials();
  return new StripeSync({
    poolConfig: { connectionString: databaseUrl },
    stripeSecretKey: secretKey,
    stripeWebhookSecret: webhookSecret,
  });
}
