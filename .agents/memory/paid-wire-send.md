---
name: Paid Wire send guarantees
description: Durable invariants for the once-per-week paid Wire send to members.
---

The weekly paid-Wire send freezes an eligible-recipient snapshot and the content in its weekly claim before anything is sent, and the claim is never released on failure — retries must replay the frozen snapshot with the same idempotency keys.

**Why:** A request error does not prove Resend rejected the batch; and membership can change between attempts, so recomputing recipients on retry would shift batch payloads and either double-send or silently skip members.

**How to apply:** Never "fix" a failed paid send by deleting the claim row or recomputing the recipient list for a retry. Entitlement rule: inactive Stripe subscription statuses are excluded; members with no subscription id (one-time purchases) stay entitled.
