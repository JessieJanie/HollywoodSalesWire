---
name: Monday Wire auto-research pipeline
description: How the weekly paid Wire + Free Edition auto-drafting works, its safety rails, and deliberately rejected alternatives.
---

# Monday auto-research pipeline

- Every Monday 5:00 PM Pacific (her explicit spec — end of business day for freshest job postings), the api-server drafts the paid Tuesday Wire (research via Skim, drafting via Anthropic) and the Free Edition, into the publisher console. Karilyn reviews Monday evening and sends Tuesday morning PT. **Nothing sends automatically — her review is the guarantee.**
- Deployment is autoscale → the in-process scheduler ticks on boot + every 5 min, with a catch-up window through Wednesday (any wake-up — including her opening the console — triggers a missed run).
- **Safety rails (deliberate, from code review — keep them):**
  - Unique index on `wire_runs.week_key` is the distributed lock (autoscale = many instances). Claim = insert onConflictDoNothing.
  - Failed runs are NEVER auto-retried (email tells her to press "Run now"); manual retry can only take over a `failed` row — a `ready` draft is never re-bought.
  - Exploration URLs proposed by the model are fetched (paid) only if https, public host, and host is a beat domain or appeared in this week's fetched pages — fetched web content is untrusted model input.
  - research_pages pruned after 35 days, page markdown capped at 200k chars.
- Draft rules baked into prompts: only claims traceable to fetched pages, every item carries "Source: URL (fetched date)", single-source items tagged **[SINGLE SOURCE — VERIFY]**, diff against last week's stored pages, no padding.
- Failure + success notifications email hello@hollywoodsaleswire.com from FROM_ADDRESS. Since Aug 7 2026 the "ready" email is a structured pre-flight report (her checklist): per-source OK/thin/failed counts, structured-feed health (ok/empty/failed with fresh-item counts), anomaly list ("NEEDS YOUR EYE"), a 10-item spot-audit suggestion, and "Ready to send: PENDING YOUR REVIEW". Empty feeds are reported as UNKNOWN, never "quiet".
- Claim-discipline rules baked into the Wire prompt (Aug 7 2026, from her research notes): signals ≠ guaranteed budgets; job posts ≠ "buying this week"; award listings ≠ "spending started"; entity formations ≠ active productions; repeats from last week never re-presented as new (must be skipped or marked "carried from last week"); uncertainty stated in the item, never smoothed away. Her principle: honesty > completeness — fewer verified items over more shaky ones.
- The spot audit (verify 10 items back to live sources) is deliberately HER manual step, prompted in the ready email — not automated.
- Karilyn wants **aggressive source exploration** — Skim is her company, reads are nearly free to her; deep sourcing is HSW's stated edge.

## Scheduled sends (Aug 2026)
- Free teaser renamed **HSW Weekly Brief** (prompt, console, email header). Both weekly emails now end with an "About HSW" block + "Publisher: Karilyn Colegrove"; Brief's "→ …" line renders as a live order-page button.
- Paid Wire email = short publisher cover note + per-member signed Shelf link + full issue. Wire body is stored in paid_wire_sends, so the Shelf shows it.
- `scheduled_sends` table + scheduler tick: one-shot timed sends, prod-only (REPLIT_DEPLOYMENT gate), seeded from `scheduledSeeds.ts` (publisher-approved copy, verbatim), lease-fenced claims, stale-week guard (a row whose week passed is marked failed, never sent, never claims a newer week's paid slot). Paid double-send guard stays the paid_wire_sends week-key claim; Brief retries use per-row Resend idempotency keys.
- Email paragraphs keep inner newlines as <br/> (registry tables).
- Citation rules (Karilyn, Aug 5 2026): receipts cite ONLY public primary-source URLs or a plain-language CITE AS description — never skim402.com feed URLs (readers hit a payment wall), never "(fetched <date>)", never research tools/vendors/search terms in either publication. Each structured Skim signal block carries its own CITE AS line; Weekly Brief prompt bans method mentions entirely. Enforced in wireResearch.ts prompts + freeEdition.ts.
- Seeds only go out after a Republish puts the code in prod; boot tick catches up if autoscale was asleep at send time.
