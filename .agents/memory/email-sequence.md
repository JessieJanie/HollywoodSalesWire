---
name: Evergreen founding-offer email funnel
description: How the opt-in signup, 5-email founding series, and token-gated offer page work together
---
Evergreen funnel (live since July 29, 2026, replacing the one-off campaign idea):
- Public site sells at the regular rate only ($77/wk individual $3,995/yr; team $9,995/yr).
- Newsletter signup sends an immediate welcome email plus her 5-email Founding-Offer series at day offsets 14, 21, 28, 35, 42 (publisher decision Aug 2, 2026: prospects get 1–2 Free Editions before any selling — Agora model — then one sales email per week).
- Resend `scheduled_at` only reaches ~30 days, so steps with offsets >28d are stored as `pending` rows in `sequence_emails`; the api-server scheduler tick claims them (leased `scheduling` status + `claimed_at`, 15-min stale-claim recovery) and hands them to Resend when within window. Unsubscribe/purchase cancel `pending`/`scheduling` rows directly; the handoff re-checks status after the Resend call and cancels the in-flight email if it lost the race. Don't simplify these guards — autoscale means concurrent ticks are real.
- Each email links to a private token-gated page `/founding-offer?token=<unsubscribe_token>` with a real per-person deadline: midnight Eastern at end of day 42 after signup. Page flips to regular pricing after expiry.
- Email 5 always lands on the deadline day by construction: both E5's send time and the deadline derive from signup + 42×24h, so they share the same ET calendar day even across DST. Do NOT "fix" the deadline to calendar-day arithmetic without moving E5 in lockstep.
- Founding checkout links are server-side only, behind `/api/founding-checkout?token=&plan=` which re-verifies the deadline before 302-ing to Stripe. Never put founding Stripe links in the client bundle.
- Unsubscribe cancels remaining scheduled Resend emails.
- Weekly free edition: publisher console at `/publisher?key=<PUBLISHER_KEY env var>` (key-gated, timing-safe check on every endpoint). She pastes the full paid Wire; `/api/publisher/draft` uses Anthropic (Replit AI proxy, lazy-imported so missing env vars can't crash startup) to draft a no-names teaser; she edits and `/api/publisher/send` batches to all active subscribers via Resend (records in `weekly_previews`). SHE reviews every draft before send — that human step is the leak guard; the teaser must never contain buyer names/contacts/deal specifics.

**Why:** cold outreach was declined; she chose the opt-in evergreen funnel (Option 1). Copy is publisher-locked (Draft 5 at `marketing/founding-offer-email-series-draft5.txt`); only mechanical substitutions allowed (salutation, link+UTM, per-subscriber deadline dates), and she wants to see every edit before anything sends/publishes.

Resend access: via `@replit/connectors-sdk` `connectors.proxy("resend", path)` in api-server code. Sender: `Hollywood Sales Wire <briefings@hollywoodsaleswires.com>` (note the extra "s" — real domain not in Resend).
