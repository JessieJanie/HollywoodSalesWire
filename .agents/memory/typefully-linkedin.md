---
name: Typefully social drafts (LinkedIn + X)
description: How the weekly Brief and Wed/Fri highlights reach Typefully, and the safety rails around them
---

# Typefully social drafts

Three drafts per week land in Karilyn's Typefully account, always as **unscheduled drafts** (never `publish_at`/`plan_at` — nothing auto-publishes; she edits/posts in Typefully):
- **Monday** (inside the research run): the free Brief rewritten for LinkedIn + a ≤260-char X version in the same draft.
- **Wednesday & Friday** (scheduler tick, ~8am PT with next-day catch-up, **production only** so a dev workspace can't push duplicates): a short one-signal highlight (LinkedIn + X). Friday is given Wednesday's post text as an "avoid this angle" hint.

**Why:** she chose Typefully over a LinkedIn developer app (LinkedIn's API can't publish articles; OAuth expires ~60d). Fits her publisher-owns-the-send rule.

**How to apply:**
- Auth = `TYPEFULLY_API_KEY` secret (Bearer, api.typefully.com v2). Social set discovered at runtime (first set with LinkedIn or X) — never hardcode set IDs. Her set has both LinkedIn and X (personal accounts; Creator plan = one set shared by HSW and RIA Wire).
- Idempotency = `social_drafts` DB table, unique (kind, week_key), kinds brief/wed/fri; insert-onConflictDoNothing is the claim, with a 30-min stale-`pending` lease takeover for crash recovery. `failed` is terminal — no auto-retry; failure sends her a notify email. Deleting a draft in Typefully must NOT recreate it (title-checking Typefully is not a valid dedupe).
- Pushes are strictly best-effort with a real cancellation deadline (one AbortSignal propagated into Anthropic + all Typefully calls, 120s ceiling) — never blocks or fails the weekly run; the Monday social block is fenced in its own try/catch so a DB error there can't mark the run failed.
- Errors are sanitized to category strings / HTTP status only — provider response bodies must never reach logs or her emails.
- Rewrites keep the Brief's information boundary (shape only, no names/figures/methods) — same Agora rules. X version is dropped (not truncated) if the model exceeds 280 chars.
- Schema deploys via Replit's Publish flow (dev→prod diff on Republish) — no manual prod migrations.
