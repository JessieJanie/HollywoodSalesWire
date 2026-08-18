---
name: Typefully social drafts (LinkedIn + X)
description: Auto-published weekly social schedule via Typefully — Mon/Wed/Fri highlights + Tuesday Brief with masthead
---

# Typefully social drafts

Four auto-published posts per week (requires Republish to go live as of Aug 18 2026):
- **Monday ~5 pm PT**: short highlight, `plan_at` = now+5min (fires when wire is ready >= 17:00 PT). Kind = "mon".
- **Tuesday ~9 am PT**: full Weekly Brief with HSW masthead image (`SITE_URL/og-card.png` via `media_urls`), `plan_at` = 15h from Monday wire completion. Kind = "brief".
- **Wednesday ~8 am PT**: short highlight, `plan_at` = now+5min. Kind = "wed".
- **Friday ~8 am PT**: short highlight, `plan_at` = now+5min. Kind = "fri".

Wednesday is given Monday's post as avoid-angle. Friday is given Wednesday's (or Monday's) post as avoid-angle.

**Why:** she chose Typefully over a LinkedIn developer app (LinkedIn's API can't publish articles; OAuth expires ~60d). Fits her publisher-owns-the-send rule. Auto-publish implemented Aug 18 2026 at her request.

**How to apply:**
- Auth = `TYPEFULLY_API_KEY` secret (Bearer, api.typefully.com v2). Social set discovered at runtime (first set with LinkedIn or X) — never hardcode set IDs. Her set has both LinkedIn and X (personal accounts; Creator plan = one set shared by HSW and RIA Wire).
- Idempotency = `social_drafts` DB table, unique (kind, week_key), kinds: brief/mon/wed/fri; insert-onConflictDoNothing is the claim, with a 30-min stale-`pending` lease takeover for crash recovery. `failed` is terminal — no auto-retry; failure sends her a notify email.
- Pushes are strictly best-effort with a real cancellation deadline (one AbortSignal propagated into Anthropic + all Typefully calls, 120s ceiling) — never blocks or fails the weekly run.
- Masthead image on Tuesday Brief uses `media_urls: [url]` in the Typefully post object — untested in prod, gracefully degrades to text-only if unsupported.
- Errors are sanitized to category strings / HTTP status only — provider response bodies must never reach logs or her emails.
- Rewrites keep the Brief's information boundary (shape only, no names/figures/methods). X gets the FULL write-up (she confirmed X Premium, long posts allowed).
- Typefully API v1 is dead (403); only v2 works. `plan_at` is the v2 field name for scheduling.
- Schema deploys via Replit's Publish flow — no manual prod migrations.
