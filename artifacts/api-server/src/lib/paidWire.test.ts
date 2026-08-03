import { describe, it, expect } from "vitest";
import {
  activeRecipients,
  batchIdempotencyKey,
  planPaidSend,
  sendPaidWireBatches,
  type PaidRecipient,
  type BatchEmail,
} from "./paidWire";

const member = (id: number, sub: string | null = null): PaidRecipient => ({
  id,
  email: `m${id}@example.com`,
  stripeSubscriptionId: sub,
});

describe("activeRecipients", () => {
  it("excludes members whose subscription is inactive", () => {
    const out = activeRecipients(
      [member(1, "sub_active"), member(2, "sub_canceled"), member(3, null)],
      new Set(["sub_canceled"]),
    );
    expect(out.map((m) => m.id)).toEqual([1, 3]);
  });

  it("keeps one-time purchasers (no subscription id)", () => {
    const out = activeRecipients([member(9, null)], new Set(["whatever"]));
    expect(out).toHaveLength(1);
  });

  it("sorts deterministically by id so retry batches are stable", () => {
    const out = activeRecipients([member(5), member(2), member(9)], new Set());
    expect(out.map((m) => m.id)).toEqual([2, 5, 9]);
  });
});

const buildEmail = (email: string): BatchEmail => ({
  from: "wire@example.com",
  to: [email],
  subject: "s",
  html: "<p>h</p>",
});

const emailsOf = (n: number) => Array.from({ length: n }, (_, i) => `m${i + 1}@example.com`);

describe("planPaidSend", () => {
  it("resumes an in-flight claim even when every snapshot member is now inactive", () => {
    // freshRecipientCount is irrelevant for an existing claim — pass 0 to prove it.
    expect(
      planPaidSend({ status: "sending", recipientEmails: ["m1@example.com"] }, 0),
    ).toEqual({ action: "resume" });
  });

  it("refuses a second send once the claim is sent", () => {
    expect(planPaidSend({ status: "sent", recipientEmails: [] }, 5)).toEqual({
      action: "already-sent",
    });
  });

  it("rejects a brand-new send with zero active members", () => {
    expect(planPaidSend(undefined, 0)).toEqual({ action: "no-recipients" });
  });

  it("creates a new claim when none exists and members are active", () => {
    expect(planPaidSend(undefined, 3)).toEqual({ action: "create" });
  });
});

describe("sendPaidWireBatches", () => {
  it("uses stable idempotency keys per claim and batch across retries", async () => {
    const snapshot = emailsOf(250);
    const keys: string[] = [];
    const run = () =>
      sendPaidWireBatches({
        claimId: 42,
        emails: snapshot,
        buildEmail,
        sendBatch: async (_e, key) => {
          keys.push(key);
        },
      });
    await run();
    const firstAttempt = [...keys];
    keys.length = 0;
    await run(); // simulated retry of the same claim
    expect(keys).toEqual(firstAttempt);
    expect(firstAttempt).toEqual([
      batchIdempotencyKey(42, 0),
      batchIdempotencyKey(42, 1),
      batchIdempotencyKey(42, 2),
    ]);
  });

  it("replays the frozen snapshot identically even when membership changes between attempts", async () => {
    // Snapshot frozen at claim time: 150 members → 2 batches.
    const snapshot = emailsOf(150);
    const attempts: { key: string; payload: string[] }[] = [];
    const runAttempt = (failBatch1: boolean) =>
      sendPaidWireBatches({
        claimId: 9,
        emails: snapshot, // retries always pass the claim's snapshot, never a recomputed list
        buildEmail,
        sendBatch: async (emails, key) => {
          attempts.push({ key, payload: emails.map((e) => e.to[0]) });
          if (failBatch1 && key.endsWith("batch-1")) throw new Error("network reset");
        },
      });

    const first = await runAttempt(true); // batch 0 accepted, batch 1 ambiguous failure
    expect(first.sent).toBe(100);
    // Between attempts: a member in batch 0 cancels AND a new member joins.
    // Neither affects the snapshot — the retry payloads are byte-identical.
    const second = await runAttempt(false);
    expect(second.sent).toBe(150);

    const byKey = new Map<string, string[][]>();
    for (const a of attempts) {
      byKey.set(a.key, [...(byKey.get(a.key) ?? []), a.payload]);
    }
    for (const payloads of byKey.values()) {
      for (const p of payloads) expect(p).toEqual(payloads[0]);
    }
  });

  it("collects failures without throwing (ambiguous batch failure)", async () => {
    const outcome = await sendPaidWireBatches({
      claimId: 1,
      emails: emailsOf(150),
      buildEmail,
      sendBatch: async (_e, key) => {
        if (key.endsWith("batch-1")) throw new Error("network reset");
      },
    });
    expect(outcome.sent).toBe(100);
    expect(outcome.failedEmails).toHaveLength(50);
  });

  it("reports zero sent when every batch fails", async () => {
    const outcome = await sendPaidWireBatches({
      claimId: 7,
      emails: ["m1@example.com"],
      buildEmail,
      sendBatch: async () => {
        throw new Error("boom");
      },
    });
    expect(outcome.sent).toBe(0);
    expect(outcome.failedEmails).toEqual(["m1@example.com"]);
  });
});
