---
name: Skim prospecting for cold-email leads
description: What Skim page reads can and cannot find for named vendor sales contacts, and how Skim-sourced prospects enter the cold pipeline.
---

# Skim prospecting for cold-email leads

- Skim is a page reader, not a contact database. Vendor "contact us" pages almost never list named people (generic info@ only), and ~half of vendor sites are bot-walled (HTTP 422, not charged).
- What DOES work: **directory-style pages that publish named booking contacts** — e.g. the MBS Equipment worldwide sound-stage directory (one ~3,800-word read yielded ~26 named studio/equipment contacts across GA, NY, CA, IL, TN, Canada, UK, Ireland). Look for more pages of that shape (trade-body member lists, film-commission vendor guides) rather than individual vendor sites.
- Skim-sourced contacts go into `SKIM_PROSPECTS` (api-server `skimProspects.ts`); `autoFillColdLeads` drains that pool first, then Apollo. Dedupe is the existing `cold_prospect_contacts` claim — entries can stay in the file permanently.
- Do not add leads to an already-sending weekly campaign: its E5 "deadline" email is pinned to that week's date, so late adds get the close after the deadline. New prospects always wait for the next batch.
- Cost reference (Oct 2, 2026 run): 62 target URLs, 39 paid reads, ≈$0.20, ~4 minutes wall-clock.

**Why:** Aug 2026 notes said "Skim failed for this niche" — true for per-vendor contact pages, false for directory pages. Target the right page shape.
