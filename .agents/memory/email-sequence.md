---
name: Evergreen founding-offer email funnel
description: How the opt-in signup, 5-email founding series, and token-gated offer page work together
---
Evergreen funnel (live since July 29, 2026, replacing the one-off campaign idea):
- Public site sells at the regular rate only ($77/wk individual $3,995/yr; team $9,995/yr).
- Newsletter signup sends an immediate welcome email plus her 5-email Founding-Offer series pre-scheduled via Resend `scheduled_at` at day offsets 7, 8, 9, 11, 14 (within Resend's 30-day limit).
- Each email links to a private token-gated page `/founding-offer?token=<unsubscribe_token>` with a real per-person deadline: midnight Eastern at end of day 14 after signup. Page flips to regular pricing after expiry.
- Email 5 always lands on the deadline day by construction: both E5's send time and the deadline derive from signup + 14×24h, so they share the same ET calendar day even across DST. Do NOT "fix" the deadline to calendar-day arithmetic without moving E5 in lockstep.
- Founding checkout links are server-side only, behind `/api/founding-checkout?token=&plan=` which re-verifies the deadline before 302-ing to Stripe. Never put founding Stripe links in the client bundle.
- Unsubscribe cancels remaining scheduled Resend emails.

**Why:** cold outreach was declined; she chose the opt-in evergreen funnel (Option 1). Copy is publisher-locked (Draft 5 at `marketing/founding-offer-email-series-draft5.txt`); only mechanical substitutions allowed (salutation, link+UTM, per-subscriber deadline dates), and she wants to see every edit before anything sends/publishes.

Resend access: via `@replit/connectors-sdk` `connectors.proxy("resend", path)` in api-server code. Sender: `Hollywood Sales Wire <briefings@hollywoodsaleswires.com>` (note the extra "s" — real domain not in Resend).
