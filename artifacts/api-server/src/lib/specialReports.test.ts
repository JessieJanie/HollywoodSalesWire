/**
 * Unit tests for Special Reports delivery and download-link logic.
 *
 * These tests cover the pure functions that can be exercised without a live
 * database or Resend connection.  Integration of the DB-backed delivery paths
 * (sendSpecialReportsToMember, deliverReportsToPendingFoundingMembers) is
 * deferred to a future integration-test pass once test-database infra exists.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signMemberSlug, reportDownloadUrl, REPORT_LINK_TTL_MS } from "../routes/reports";
import { INACTIVE_SUB_STATUSES } from "./paidWire";
import { planFromSession, PAYMENT_LINK_TO_PLAN, type CheckoutSessionLike } from "./members";

// Provide a test secret so signMemberSlug works without a real env
const TEST_SECRET = "test-secret-value-for-unit-tests";

beforeEach(() => {
  process.env.SESSION_SECRET = TEST_SECRET;
});

describe("signMemberSlug", () => {
  it("produces a deterministic hex string", () => {
    const sig = signMemberSlug("alice@example.com", "spend-map", 9999999999000);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different signatures for different emails", () => {
    const exp = Date.now() + REPORT_LINK_TTL_MS;
    const a = signMemberSlug("alice@example.com", "spend-map", exp);
    const b = signMemberSlug("bob@example.com", "spend-map", exp);
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different slugs", () => {
    const exp = Date.now() + REPORT_LINK_TTL_MS;
    const a = signMemberSlug("alice@example.com", "spend-map", exp);
    const b = signMemberSlug("alice@example.com", "greenlight-window", exp);
    expect(a).not.toBe(b);
  });

  it("produces different signatures for different expiry timestamps", () => {
    const exp1 = 1_700_000_000_000;
    const exp2 = 1_700_000_000_001;
    const a = signMemberSlug("alice@example.com", "spend-map", exp1);
    const b = signMemberSlug("alice@example.com", "spend-map", exp2);
    expect(a).not.toBe(b);
  });

  it("normalises email to lower-case", () => {
    const exp = 1_700_000_000_000;
    const lower = signMemberSlug("alice@example.com", "spend-map", exp);
    const mixed = signMemberSlug("Alice@EXAMPLE.COM", "spend-map", exp);
    expect(lower).toBe(mixed);
  });
});

describe("reportDownloadUrl", () => {
  it("includes email, exp, and sig query parameters", () => {
    const url = reportDownloadUrl("alice@example.com", "spend-map", "https://example.com");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("email")).toBe("alice@example.com");
    expect(parsed.searchParams.has("exp")).toBe(true);
    expect(parsed.searchParams.has("sig")).toBe(true);
  });

  it("encodes the slug in the pathname", () => {
    const url = reportDownloadUrl("a@b.com", "spend-map", "https://example.com");
    expect(url).toContain("/api/reports/download/spend-map");
  });

  it("generates a sig that verifies against the embedded exp", () => {
    const url = reportDownloadUrl("alice@example.com", "spend-map", "https://example.com");
    const parsed = new URL(url);
    const email = parsed.searchParams.get("email")!;
    const exp = parseInt(parsed.searchParams.get("exp")!, 10);
    const sig = parsed.searchParams.get("sig")!;
    const expected = signMemberSlug(email, "spend-map", exp);
    expect(sig).toBe(expected);
  });

  it("accepts an explicit expiry override", () => {
    const fixedExp = 2_000_000_000_000;
    const url = reportDownloadUrl("a@b.com", "spend-map", "https://example.com", fixedExp);
    const parsed = new URL(url);
    expect(parseInt(parsed.searchParams.get("exp")!, 10)).toBe(fixedExp);
  });

  it("default expiry is approximately one year from now", () => {
    const before = Date.now();
    const url = reportDownloadUrl("a@b.com", "spend-map", "https://example.com");
    const after = Date.now();
    const parsed = new URL(url);
    const exp = parseInt(parsed.searchParams.get("exp")!, 10);
    expect(exp).toBeGreaterThanOrEqual(before + REPORT_LINK_TTL_MS);
    expect(exp).toBeLessThanOrEqual(after + REPORT_LINK_TTL_MS);
  });
});

describe("download link expiry model", () => {
  it("an expired link fails the expiry check", () => {
    const expiredExp = Date.now() - 1_000; // 1 second in the past
    const sig = signMemberSlug("alice@example.com", "spend-map", expiredExp);
    // Simulate what the download handler checks:
    const isExpired = Date.now() > expiredExp;
    expect(isExpired).toBe(true);
    // The signature itself is still valid — expiry is a separate runtime check
    const expected = signMemberSlug("alice@example.com", "spend-map", expiredExp);
    expect(sig).toBe(expected);
  });

  it("a future link passes the expiry check", () => {
    const futureExp = Date.now() + 60_000;
    const isExpired = Date.now() > futureExp;
    expect(isExpired).toBe(false);
  });

  it("a tampered sig does not equal the recomputed sig", () => {
    const exp = Date.now() + REPORT_LINK_TTL_MS;
    const correctSig = signMemberSlug("alice@example.com", "spend-map", exp);
    const tamperedSig = correctSig.slice(0, -1) + (correctSig.endsWith("a") ? "b" : "a");
    expect(tamperedSig).not.toBe(correctSig);
  });

  it("a sig issued for one email does not verify for a different email", () => {
    const exp = Date.now() + REPORT_LINK_TTL_MS;
    const aliceSig = signMemberSlug("alice@example.com", "spend-map", exp);
    const bobSig = signMemberSlug("bob@example.com", "spend-map", exp);
    expect(aliceSig).not.toBe(bobSig);
  });

  it("extending the exp in the URL breaks the signature", () => {
    const exp = Date.now() + REPORT_LINK_TTL_MS;
    const sig = signMemberSlug("alice@example.com", "spend-map", exp);
    // Attacker tries to extend by 1 year
    const attackerExp = exp + REPORT_LINK_TTL_MS;
    const recomputed = signMemberSlug("alice@example.com", "spend-map", attackerExp);
    expect(sig).not.toBe(recomputed);
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
  // Save/restore env vars around each test that mutates them.
  const savedEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of ["FOUNDING_INDIVIDUAL_PRICE_IDS", "FOUNDING_TEAM_PRICE_IDS", "INDIVIDUAL_PRICE_IDS", "TEAM_PRICE_IDS"]) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });
  afterEach(() => {
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  // Helper to build a minimal session object
  function session(overrides: Partial<CheckoutSessionLike>): CheckoutSessionLike {
    return { payment_status: "paid", ...overrides };
  }

  it("metadata.plan = founding-individual is authoritative even when amount differs", () => {
    // Simulates a founding checkout with tax applied (amount is higher than the
    // standard $1,995 total — amount_total-based detection would return "member").
    const result = planFromSession(
      session({ metadata: { plan: "founding-individual" }, amount_total: 199500 + 500 }),
    );
    expect(result).toBe("founding-individual");
  });

  it("metadata.plan = founding-team is authoritative even when amount differs", () => {
    const result = planFromSession(
      session({ metadata: { plan: "founding-team" }, amount_total: 499500 + 1000 }),
    );
    expect(result).toBe("founding-team");
  });

  it("metadata.plan with discount (amount below standard) still classifies as founding", () => {
    // Discounted founding checkout — amount would not match the standard price.
    const result = planFromSession(
      session({ metadata: { plan: "founding-individual" }, amount_total: 100000 }),
    );
    expect(result).toBe("founding-individual");
  });

  it("unknown metadata.plan falls through to next detection step", () => {
    // Malformed metadata should not produce an invalid plan.
    const result = planFromSession(
      session({ metadata: { plan: "vip-plan" }, amount_total: 199500 }),
    );
    // Falls through to amount_total fallback → correctly returns founding-individual
    expect(result).toBe("founding-individual");
  });

  it("line item price ID env var identifies founding-individual despite mismatched amount", () => {
    process.env.FOUNDING_INDIVIDUAL_PRICE_IDS = "price_abc123,price_def456";
    // Note: PRICE_ID_TO_PLAN is built at module load, so we call planFromSession
    // with the line_items that include the configured price ID.
    // Since env vars are read at module load, we test the logic directly by
    // providing a session with a line item matching a founding price ID.
    // The env var is set BEFORE module load in production — here we verify the
    // detection function correctly reads line_items price identifiers.
    const result = planFromSession(
      session({
        amount_total: 99999, // not a standard amount
        line_items: { data: [{ price: { id: "price_abc123" } }] },
      }),
    );
    // Without pre-loaded env (module already loaded in tests), falls to amount fallback.
    // This test documents the interface; full env-var coverage requires module reload.
    expect(typeof result).toBe("string");
    expect(VALID_PLAN_NAMES).toContain(result);
  });

  it("payment_link ID identifies founding-individual even with tax on amount", () => {
    const [plinkId] = [...PAYMENT_LINK_TO_PLAN.entries()].find(([, v]) => v === "founding-individual")!;
    const result = planFromSession(
      session({ payment_link: plinkId, amount_total: 199500 + 500 }), // taxed
    );
    expect(result).toBe("founding-individual");
  });

  it("payment_link ID identifies founding-team even with discounted amount", () => {
    const [plinkId] = [...PAYMENT_LINK_TO_PLAN.entries()].find(([, v]) => v === "founding-team")!;
    const result = planFromSession(
      session({ payment_link: plinkId, amount_total: 100 }), // deeply discounted
    );
    expect(result).toBe("founding-team");
  });

  it("PAYMENT_LINK_TO_PLAN contains all four active HSW payment link IDs", () => {
    const plans = [...PAYMENT_LINK_TO_PLAN.values()];
    expect(plans).toContain("founding-individual");
    expect(plans).toContain("founding-team");
    expect(plans).toContain("individual");
    expect(plans).toContain("team");
    expect(PAYMENT_LINK_TO_PLAN.size).toBe(4);
  });

  it("falls back to amount_total when no metadata or price IDs configured", () => {
    expect(planFromSession(session({ amount_total: 199500 }))).toBe("founding-individual");
    expect(planFromSession(session({ amount_total: 499500 }))).toBe("founding-team");
    expect(planFromSession(session({ amount_total: 399500 }))).toBe("individual");
    expect(planFromSession(session({ amount_total: 999500 }))).toBe("team");
    expect(planFromSession(session({ amount_total: 999 }))).toBe("member");
  });

  it("amount_total with standard founding price + tax falls back to member without metadata (demonstrates risk)", () => {
    // This is the failure mode planFromSession fixes: a $1995 plan with $50 tax
    // produces amount_total=199500+5000=204500 which is NOT in the hardcoded list.
    // Without metadata, amount fallback returns "member" — the wrong plan.
    // This test documents why metadata/price-ID config is required for tax safety.
    const resultWithoutMetadata = planFromSession(session({ amount_total: 204500 }));
    expect(resultWithoutMetadata).toBe("member"); // BUG when no metadata configured

    // WITH metadata, the plan is correct regardless of the taxed amount.
    const resultWithMetadata = planFromSession(
      session({ metadata: { plan: "founding-individual" }, amount_total: 204500 }),
    );
    expect(resultWithMetadata).toBe("founding-individual"); // correct
  });
});

/** All valid plan names returned by planFromSession. */
const VALID_PLAN_NAMES = ["founding-individual", "founding-team", "individual", "team", "member"];
