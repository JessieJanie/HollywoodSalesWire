---
name: Warm-list email marketing
description: How the signup/email marketing flow works and its constraints
---

- Opt-in only: cold outreach / scraped-prospect emailing was explicitly declined (July 2026); do not build it.
- Signup = ONE immediate welcome email + add to the warm prospect list (Postgres `email_subscribers`). No automated drip series — publisher rejected auto-scheduling (July 29, 2026) because her copy is tied to calendar deadlines.
- **Why:** her campaigns use real date-limited offers (e.g. "ends Aug 4 midnight"); relative-to-signup scheduling would make deadline claims false for late signups.
- Campaigns to the warm list are run manually, synced to a specific dated offer. Her Founding-Offer 5-email copy is saved verbatim at `marketing/founding-offer-email-series-draft5.txt` (publisher-locked — never rewrite claims/pricing).
- Sends via the Resend connector from `briefings@hollywoodsaleswires.com` (throwaway-spelling domain; the real hollywoodsaleswire.com is NOT verified in Resend).
- Unsubscribe link marks the subscriber unsubscribed and cancels any Resend-scheduled emails.
