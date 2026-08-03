---
name: Shelf & publisher access model
description: How members and the publisher get into the Shelf / publisher console (magic link + remember-me), and the deliberate revocation policy.
---

# Shelf & publisher access model (Aug 2026)

- No passwords anywhere. Member Shelf access = permanent HMAC-signed link (SESSION_SECRET) **plus** a 1-year HttpOnly remember-me cookie set the first time a valid link is opened; later visits to /shelf work cookie-only. A public "email me my link" form on /shelf mails the permanent link (generic response always; hourly Resend idempotency + in-memory per-IP/global rate caps).
- Publisher console: `?key=` is saved to localStorage on first visit and stripped from the URL; later visits read from storage. Stale keys are cleared on auth failure.
- **Why:** Karilyn (and members) kept losing links; she wanted Stripe/Cloudflare-style "just open the site" access without logins.
- **Deliberate policy:** canceled members KEEP Shelf access to what was sent while they were members ("yours to keep"). An architect review flagged this as a revocation gap — it is intentional; do not "fix" it without her asking.
- Dev and prod share SESSION_SECRET, so links/sigs computed in the dev shell are valid on production.

## Latest-issue fallback + naming (Aug 3, 2026)
Members with no issues of their own see the single latest finalized (status='sent') HSW Weekly Wire on their Shelf — gated by entitledToNewPaidContent() (lib/entitlement.ts; no sub id = comp = entitled, inactive Stripe status = excluded). Historical issues stay recipientEmails-scoped ("yours to keep"). Publisher-mandated proper nouns everywhere: "HSW Shelf" and "HSW Weekly Wire"; never use "teach/taught" in prospect/subscriber copy (use review/reveal/share/show). Report download links serve Content-Disposition: inline (readable in browser, publisher preference). Welcome email personalizes with first name from Stripe customer_details.name (members.name column; prod column arrives via Publish schema diff).
