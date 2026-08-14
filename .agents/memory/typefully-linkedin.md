---
name: Typefully LinkedIn drafts
description: How the weekly Brief reaches LinkedIn via Typefully, and the safety rails around it
---

# Typefully LinkedIn drafts

The Monday research run pushes a LinkedIn rewrite of the free Weekly Brief into Karilyn's Typefully account as an **unscheduled draft** (never `publish_at`/`plan_at` — nothing auto-publishes; she edits/posts in Typefully).

**Why:** she chose Typefully over a LinkedIn developer app (LinkedIn's API can't publish long-form articles at all, and OAuth tokens expire ~60 days). Fits her publisher-owns-the-send rule.

**How to apply:**
- Auth = `TYPEFULLY_API_KEY` secret (Bearer, api.typefully.com v2). Social set is discovered at runtime (first set with LinkedIn connected) — do not hardcode set IDs.
- The push is strictly best-effort: overall + per-request timeouts, never throws, never blocks the run; outcome is one sanitized status line in the pre-flight email (status codes only, never provider response bodies — review flagged that as a leak vector).
- The LinkedIn rewrite keeps the Brief's information boundary (shape only, no names/figures/methods) — same Agora rules.
- Her plan: Typefully Creator = ONE social set (her personal LinkedIn+X). Both HSW and RIA Wire post through her personal accounts; separate brand accounts would need the per-set Business plan.
- X is not yet connected in her Typefully set; LinkedIn is.
