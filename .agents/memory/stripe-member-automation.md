---
name: Stripe new-member automation
description: How paid-subscriber automation works (webhook → member record → welcome email → series cancel → publisher notify) and its quirks.
---
# Stripe new-member automation (built Aug 2, 2026)

Flow: live payment link checkout → managed Stripe webhook (`/api/stripe/webhook`, registered per-environment at startup by stripe-replit-sync) → signature verified → `members` table upsert → founding-offer scheduled sales emails canceled for that address → one-time welcome email → notification to hello@hollywoodsaleswire.com.

Durable rules & quirks:
- **stripe-replit-sync must stay externalized in api-server `build.mjs`** — it reads its SQL migration files from its package dir; bundling it makes `runMigrations` silently create nothing ("relation stripe.accounts does not exist" at webhook setup).
- This repl's Stripe connection stores the API key under `settings.secret` (not `secret_key`); stripeClient accepts both and prefers the live-key connection among multiple.
- Retry/concurrency safety: welcome + publisher notify are gated on an atomic claim of `members.welcome_sent_at` (UPDATE … WHERE NULL RETURNING); claim is released if the welcome send fails; member-persistence failure returns 500 so Stripe retries. Never weaken these — autoscale means concurrent webhook deliveries are real.
- Plan label is mapped from `amount_total` (1995/4995/3995/9995 ×100) — label-only, falls back to "member"; fine unless it starts driving entitlements, then switch to price IDs.
- Special Reports delivery to founding members is still MANUAL (notification email reminds her).
- Welcome-email copy was agent-drafted and flagged for the publisher's review (publisher-locked policy).
- Dev registers a dev-domain webhook; production registers its own on first boot after Republish — automation is NOT live in production until she republishes.
