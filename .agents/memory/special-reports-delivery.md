---
name: Special Reports delivery architecture
description: Design decisions for the Founding Member Special Reports delivery system — outbox pattern, plan detection, migration strategy, idempotency.
---

# Special Reports Delivery Architecture

## Two-state outbox for report delivery
- `specialReportsSentAt` = lease claim timestamp (set at delivery start)
- `specialReportsDeliveredAt` = confirmed delivery (set only after Resend accepts)
- Claim WHERE: `sentAt IS NULL AND deliveredAt IS NULL`
- On success: set `deliveredAt`
- On Resend error: **do NOT release the lease** — let stale-lease TTL (15 min) recover it
- **Why:** Releasing immediately risks duplicate delivery when Resend may have already accepted the call (network error on our side). The 15-min stale-lease TTL is well within Resend's 24h idempotency retention window.

## Scheduler tick for recovery
- `tickReportDeliveries()` runs every 5 min: resets stale leases, then calls `deliverReportsToPendingFoundingMembers()`
- `resetStaleReportLeases()` exported for testing; uses `sentAt < NOW() - 15min AND deliveredAt IS NULL`

## Plan detection from Stripe checkout session (`planFromSession`)
Ordered precedence (most → least stable):
1. `session.metadata.plan` — set on all 4 HSW payment links via Stripe API (July 2026). **Primary path.**
2. `PAYMENT_LINK_TO_PLAN` — hardcoded map of known `plink_xxx` IDs → plan strings. Survives tax/discount without session expansion.
3. `PRICE_ID_TO_PLAN` — built from env vars at module load (comma-separated price IDs per plan).
4. `amount_total` — last resort, logs a warning.
**Why:** `amount_total` changes with Stripe taxes and discounts, causing mis-classification of founding members as generic members.

## Known payment link IDs (live)
- `plink_1Tyebb8TDFH4346h8N2L6T6W` → founding-individual
- `plink_1Tyebb8TDFH4346hhxbXDUyX` → founding-team
- `plink_1TyeTj8TDFH4346hT3eAICwp` → individual
- `plink_1TyeTj8TDFH4346hYySSS9GB` → team

## Download entitlement check — "yours to keep" policy (Aug 2, 2026)
- Publisher decision: Special Reports remain downloadable FOREVER for founding members, even after cancellation — the offer said "yours to keep", and continued access encourages resubscribing.
- Route checks only HMAC validity + expiry + founding plan in `members`; NO subscription-status check. The paid-Wire send path still excludes inactive subs (that's different — weekly content, not a keeper).
- **How to apply:** never add a Stripe status check back to the report download route; a test in specialReports.test.ts guards this.

## Migration strategy
- Post-merge script uses `drizzle-kit push` (NOT migrate) — production DB pre-dates Drizzle journal
- Migration file `lib/db/migrations/0000_colossal_wallow.sql` kept as SQL documentation for future incremental migrations
- **Why:** Switching to `migrate` on a pre-journal production DB would fail ("relation already exists") even with IF NOT EXISTS, because existing tables may differ from baseline schema.

## Resend idempotency keys for report delivery
- Key: `sha256("special-reports-v1:<normalized-email>")` 
- Same key on checkout path and retroactive delivery path
- **Why:** Resend deduplicates within 24h; stale-lease recovery retries within 15 min — well inside window.
