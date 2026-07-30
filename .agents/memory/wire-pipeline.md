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
- Failure + success notifications email hello@hollywoodsaleswire.com from FROM_ADDRESS.
- Karilyn wants **aggressive source exploration** — Skim is her company, reads are nearly free to her; deep sourcing is HSW's stated edge.
