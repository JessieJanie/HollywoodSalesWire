---
name: Instantly campaign bulk cleanup
description: How to safely identify and bulk-delete orphaned Instantly campaigns without touching real ones.
---

`cold_campaigns.campaign_id` (prod DB) is the source of truth for which Instantly campaign IDs are real. Duplicate-shell campaigns from the pre-dedup era share the exact same `name` as a real campaign but have a different `id`, so name matching alone cannot distinguish real vs. orphan — always diff by ID against the DB table.

**Why:** the old claim/retry logic (pre-idempotency-fix) created multiple provider campaigns for the same batch tag before settling on one; the abandoned ones only got the monitor lead (kerricolegrove@gmail.com) enrolled, never real prospects.

**How to apply:** list all Instantly campaigns via `GET /campaigns` (paginate with `starting_after`/`next_starting_after`, `limit=100`), filter by name prefix, exclude any ID present in `cold_campaigns.campaign_id`, and delete the rest with `DELETE /campaigns/:id` (returns 200 + the deleted object). The `/campaigns/analytics/overview` endpoint ignores its `campaign_id` filter and returns account-wide numbers — do not use it to check per-campaign lead activity; use `POST /leads/list` with `{ campaign: id }` instead. Other unrelated product campaigns (e.g. "RIA Wire Founding Offer ...") share the same Instantly account — always scope by exact name prefix before deleting anything.
