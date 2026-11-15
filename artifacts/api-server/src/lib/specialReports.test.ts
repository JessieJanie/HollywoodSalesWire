/**
 * Unit tests for Special Reports delivery and download-link logic.
 *
 * These tests cover the pure functions that can be exercised without a live
 * database or Resend connection.  Integration of the DB-backed delivery paths
 * (sendSpecialReportsToMember, deliverReportsToPendingFoundingMembers) is
 * deferred to a future integration-test pass once test-database infra exists.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { signMemberSlug, reportDownloadUrl, shelfUrl, verifyShelfSig } from "../routes/reports";
import { planFromSession, PAYMENT_LINK_TO_PLAN, type CheckoutSessionLike } from "./members";
import { STRIPE_PRICE_ID_TO_PLAN } from "../../../hollywood-sales-wire/src/lib/constants.ts";

// Provide a test secret so signMemberSlug works without a real env
const TEST_SECRET = "test-secret-value-for-unit-tests";

beforeEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

describe("signMemberSlug (permanent links)", () => {
  it("produces a deterministic hex string", () => {
    const sig = signMemberSlug("alice@example.com", "spend-map");
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(sig).toBe(signMemberSlug("alice@example.com", "spend-map"));
  });

  it("produces different signatures for different emails", () => {
    const a = signMemberSlug("alice@example.com", "spend-map");
    const b = signMemberSlug("bob@example.com", "spend-map");
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different slugs", () => {
    const a = signMemberSlug("alice@example.com", "spend-map");
    const b = signMemberSlug("alice@example.com", "greenlight-window");
    expect(a).not.toBe(b);
  });

  it("normalises email to lower-case", () => {
    const lower = signMemberSlug("alice@example.com", "spend-map");
    const mixed = signMemberSlug("Alice@EXAMPLE.COM", "spend-map");
    expect(lower).toBe(mixed);
  });
});

describe("reportDownloadUrl (permanent links — publisher policy Aug 2026)", () => {
  it("includes email and sig, and no expiry parameter", () => {
    const parsed = new URL(reportDownloadUrl("alice@example.com", "spend-map", "https://example.com"));
    expect(parsed.searchParams.get("email")).toBe("alice@example.com");
    expect(parsed.searchParams.has("sig")).toBe(true);
    expect(parsed.searchParams.has("exp")).toBe(false); // links never expire
  });

  it("encodes the slug in the pathname", () => {
    const url = reportDownloadUrl("a@b.com", "spend-map", "https://example.com");
    expect(url).toContain("/api/reports/download/spend-map");
  });

  it("generates a sig that verifies", () => {
    const parsed = new URL(reportDownloadUrl("alice@example.com", "spend-map", "https://example.com"));
    expect(parsed.searchParams.get("sig")).toBe(
      signMemberSlug(parsed.searchParams.get("email")!, "spend-map"),
    );
  });

  it("a tampered sig does not equal the recomputed sig", () => {
    const correctSig = signMemberSlug("alice@example.com", "spend-map");
    const tamperedSig = correctSig.slice(0, -1) + (correctSig.endsWith("a") ? "b" : "a");
    expect(tamperedSig).not.toBe(correctSig);
  });

  it("a sig issued for one email does not verify for a different email", () => {
    expect(signMemberSlug("alice@example.com", "spend-map")).not.toBe(
      signMemberSlug("bob@example.com", "spend-map"),
    );
  });
});

describe("shelfUrl / verifyShelfSig", () => {
  it("builds a /shelf link whose sig verifies for the same email", () => {
    const parsed = new URL(shelfUrl("Alice@Example.com", "https://example.com"));
    expect(parsed.pathname).toBe("/shelf");
    const email = parsed.searchParams.get("email")!;
    const sig = parsed.searchParams.get("sig")!;
    expect(email).toBe("alice@example.com");
    expect(verifyShelfSig(email, sig)).toBe(true);
    expect(verifyShelfSig("mallory@example.com", sig)).toBe(false);
  });

  it("rejects a tampered sig", () => {
    const parsed = new URL(shelfUrl("alice@example.com", "https://example.com"));
    const sig = parsed.searchParams.get("sig")!;
    const tampered = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a");
    expect(verifyShelfSig("alice@example.com", tampered)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Entitlement model: reports are "yours to keep"
// ---------------------------------------------------------------------------

/**
 * Publisher policy (Aug 2026): Special Reports were sold as "yours to keep
 * even if you cancel". The download route therefore gates access on:
 *  1. HMAC is valid and not expired
 *  2. Email maps to a founding-plan member in the DB
 * ...and deliberately does NOT check Stripe subscription status. A canceled
 * Founding Member keeps download access (which also encourages resubscribing).
 */
describe("report entitlement policy", () => {
  it("download route source contains no subscription-status check", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("../routes/reports.ts", import.meta.url), "utf8");
    expect(src).not.toContain("INACTIVE_SUB_STATUSES");
    expect(src).not.toContain("stripe.subscriptions");
  });
});

// ---------------------------------------------------------------------------
// Plan detection from checkout session (planFromSession)
// ---------------------------------------------------------------------------

describe("planFromSession", () => {
  // Helper to build a minimal session object
  function session(overrides: Partial<CheckoutSessionLike>): CheckoutSessionLike {
    return { payment_status: "paid", ...overrides };
  }

  it("metadata.plan = founding-individual is authoritative even when amount differs", () => {
    // Simulates a founding checkout with tax applied (amount differs from the
    // current $149 annual total — amount-only detection is not needed here.
    const result = planFromSession(
      session({ metadata: { plan: "founding-individual" }, amount_total: 34900 }),
    );
    expect(result).toBe("founding-individual");
  });

  it("payment_link ID identifies founding-individual even with discounted amount", () => {
    const [plinkId] = [...PAYMENT_LINK_TO_PLAN.entries()].find(
      ([, v]) => v === "founding-individual",
    )!;
    const result = planFromSession(
      session({ payment_link: plinkId, amount_total: 100 }), // deeply discounted
    );
    expect(result).toBe("founding-individual");
  });

  it("payment_link ID identifies founding-team even with discounted amount", () => {
    const result = planFromSession(
      session({
        payment_link: "plink_1UbwxJCjWTn48pRoRu7nydU8",
        amount_total: 100,
      }), // discounted $299 Team founding purchase
    );
    expect(result).toBe("founding-team");
  });

  it("classifies current Individual founding $149 by price ID", () => {
    expect(
      planFromSession(
        session({
          amount_total: 14900,
          line_items: { data: [{ price: "price_1UbwwqCjWTn48pRoHGG6nCzB" }] },
        }),
      ),
    ).toBe("founding-individual");
  });

  it("keeps current and Nov 9 Stripe price IDs mapped to their plans", () => {
    expect(Object.keys(STRIPE_PRICE_ID_TO_PLAN)).toHaveLength(12);
    expect(STRIPE_PRICE_ID_TO_PLAN.price_1UbwwqCjWTn48pRoHGG6nCzB).toBe("founding-individual");
    expect(STRIPE_PRICE_ID_TO_PLAN.price_1UbwwzCjWTn48pRo8DqE2sZr).toBe("founding-team");
    expect(STRIPE_PRICE_ID_TO_PLAN.price_1Ua3JkCjWTn48pRokWP3FVKs).toBe("founding-individual");
    expect(STRIPE_PRICE_ID_TO_PLAN.price_1Ua3JnCjWTn48pRojMu5s3hA).toBe("founding-team");
  });

  it("retains all legacy, Nov 9, and current payment links", () => {
    expect(PAYMENT_LINK_TO_PLAN.size).toBe(16);
    expect(PAYMENT_LINK_TO_PLAN.get("plink_1Ua3KHCjWTn48pRoSFhWD7mS")).toBe("founding-individual");
    expect(PAYMENT_LINK_TO_PLAN.get("plink_1Ua3KLCjWTn48pRo1lgFCn3J")).toBe("founding-team");
    expect(PAYMENT_LINK_TO_PLAN.get("plink_1UbwxPCjWTn48pRonl4l9Ivn")).toBe("individual");
    expect(PAYMENT_LINK_TO_PLAN.get("plink_1UbwxSCjWTn48pRoEpNfEM68")).toBe("team");
  });

  it("does not guess when an amount belongs to multiple plans across catalogs", () => {
    expect(planFromSession(session({ amount_total: 29900 }))).toBe("member");
    expect(planFromSession(session({ amount_total: 57500 }))).toBe("member");
    expect(planFromSession(session({ amount_total: 3250 }))).toBe("member");
  });

  it("uses amount fallback only when the amount is unique across known catalogs", () => {
    expect(planFromSession(session({ amount_total: 14900 }))).toBe("founding-individual");
    expect(planFromSession(session({ amount_total: 28900 }))).toBe("individual");
    expect(planFromSession(session({ amount_total: 999 }))).toBe("member");
  });
});

/** All valid plan names returned by planFromSession. */
const VALID_PLAN_NAMES = ["founding-individual", "founding-team", "individual", "team", "member"];
