import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runMigrations } from "stripe-replit-sync";
import { getStripeClientContext } from "./stripeClient";
import { resendRequest } from "./resend";
import {
  EXPECTED_STRIPE_ACCOUNT_ID,
  EXPECTED_STRIPE_WEBHOOK_ID,
  EXPECTED_STRIPE_WEBHOOK_URL,
} from "./stripeConfig";
import {
  initStripe,
  stripeAlertIdempotencyKey,
  verifyExpectedStripeWebhook,
} from "./stripeInit";

vi.mock("stripe-replit-sync", () => ({ runMigrations: vi.fn() }));
vi.mock("./stripeClient", () => ({ getStripeClientContext: vi.fn() }));
vi.mock("./resend", () => ({ resendRequest: vi.fn() }));

const originalDatabaseUrl = process.env.DATABASE_URL;

beforeEach(() => {
  process.env.DATABASE_URL = "postgres://stripe-init-test";
  vi.mocked(runMigrations).mockResolvedValue(undefined);
  vi.mocked(resendRequest).mockResolvedValue({});
});

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  vi.clearAllMocks();
});

function stripeMock(accountId = EXPECTED_STRIPE_ACCOUNT_ID, endpointOverrides = {}) {
  const writes = {
    create: vi.fn(),
    update: vi.fn(),
    del: vi.fn(),
  };
  const stripe = {
    accounts: {
      retrieve: vi.fn().mockResolvedValue({ id: accountId }),
    },
    webhookEndpoints: {
      retrieve: vi.fn().mockResolvedValue({
        id: EXPECTED_STRIPE_WEBHOOK_ID,
        url: EXPECTED_STRIPE_WEBHOOK_URL,
        status: "enabled",
        ...endpointOverrides,
      }),
      ...writes,
    },
  } as unknown as Stripe;

  return { stripe, writes };
}

describe("read-only Stripe startup webhook verification", () => {
  it("verifies the pinned live account and enabled endpoint without Stripe writes", async () => {
    const { stripe, writes } = stripeMock();

    const result = await verifyExpectedStripeWebhook(stripe, "live");

    expect(result).toEqual({ ok: true, accountId: EXPECTED_STRIPE_ACCOUNT_ID });
    expect(stripe.accounts.retrieve).toHaveBeenCalledWith(null);
    expect(stripe.webhookEndpoints.retrieve).toHaveBeenCalledWith(EXPECTED_STRIPE_WEBHOOK_ID);
    expect(writes.create).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.del).not.toHaveBeenCalled();
  });

  it("stops before endpoint retrieval when the live account does not match", async () => {
    const { stripe, writes } = stripeMock("acct_wrong");

    const result = await verifyExpectedStripeWebhook(stripe, "live");

    expect(result).toMatchObject({ ok: false, accountId: "acct_wrong" });
    expect(stripe.webhookEndpoints.retrieve).not.toHaveBeenCalled();
    expect(writes.create).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.del).not.toHaveBeenCalled();
  });

  it("does not call Stripe when the selected credential is not live", async () => {
    const { stripe, writes } = stripeMock();

    const result = await verifyExpectedStripeWebhook(stripe, "test");

    expect(result).toMatchObject({ ok: false });
    expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    expect(stripe.webhookEndpoints.retrieve).not.toHaveBeenCalled();
    expect(writes.create).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.del).not.toHaveBeenCalled();
  });

  it("reports disabled or mismatched endpoints without attempting to repair them", async () => {
    for (const endpointOverrides of [
      { status: "disabled" },
      { url: "https://wrong.example/api/stripe/webhook" },
    ]) {
      const { stripe, writes } = stripeMock(EXPECTED_STRIPE_ACCOUNT_ID, endpointOverrides);

      const result = await verifyExpectedStripeWebhook(stripe, "live");

      expect(result).toMatchObject({ ok: false });
      expect(writes.create).not.toHaveBeenCalled();
      expect(writes.update).not.toHaveBeenCalled();
      expect(writes.del).not.toHaveBeenCalled();
    }
  });

  it("runs the startup verifier without any Stripe write call", async () => {
    const { stripe, writes } = stripeMock();
    vi.mocked(getStripeClientContext).mockResolvedValue({ stripe, mode: "live" });

    await initStripe();

    expect(stripe.accounts.retrieve).toHaveBeenCalledWith(null);
    expect(stripe.webhookEndpoints.retrieve).toHaveBeenCalledWith(EXPECTED_STRIPE_WEBHOOK_ID);
    expect(writes.create).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.del).not.toHaveBeenCalled();
    expect(resendRequest).not.toHaveBeenCalled();
  });

  it("alerts the owner on an account mismatch without writing to Stripe", async () => {
    const { stripe, writes } = stripeMock("acct_wrong");
    vi.mocked(getStripeClientContext).mockResolvedValue({ stripe, mode: "live" });

    await initStripe();

    expect(stripe.webhookEndpoints.retrieve).not.toHaveBeenCalled();
    expect(writes.create).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.del).not.toHaveBeenCalled();
    expect(resendRequest).toHaveBeenCalledOnce();
  });

  it("dedupes repeated cold-start alerts with a stable per-reason idempotency key", async () => {
    const { stripe } = stripeMock("acct_wrong");
    vi.mocked(getStripeClientContext).mockResolvedValue({ stripe, mode: "live" });

    await initStripe();
    await initStripe();

    const calls = vi.mocked(resendRequest).mock.calls;
    expect(calls).toHaveLength(2);
    const keys = calls.map(([, init]) => init.headers?.["Idempotency-Key"]);
    expect(keys[0]).toMatch(/^stripe-webhook-verification-[0-9a-f]{32}$/);
    expect(keys[1]).toBe(keys[0]);
    expect(stripeAlertIdempotencyKey("other reason")).not.toBe(keys[0]);
  });
});
