---
name: Instantly cold email campaign setup
description: How HSW cold outreach campaigns are structured in Instantly, including API quirks and the rolling-deadline offer pattern.
---

# Instantly Cold Email Campaign

## Account
- Sending mailbox: `karilyn@hollywoodsaleswires.com` (note the extra 's' — different domain from the site)
- Second mailbox in account: `karilyn@ria-wires.com` (for RIA Wire, not HSW)
- API: `https://api.instantly.ai/api/v2`, Bearer auth via `INSTANTLY_API_KEY` secret

## Sending-domain and tracking-domain separation
- Active sender domains are `hollywoodsaleswires.com`, `tryhollywoodsaleswire.com`, `hollywood-sales-wire.com`, `ria-wires.com`, `tryriawire.com`, and `getriawire.com`.
- Instantly custom tracking hosts use `inst.*`; do not redirect or alter these hosts.

**Why:** Sending mail and web/tracking traffic use different DNS functions; redirecting a sender domain's root is safe only when the Instantly tracking hosts remain separate and email records stay intact.

**How to apply:** Redirect each sender domain's root and `www` web host to its real site, while preserving all MX, SPF, DKIM, and DMARC records and leaving every `inst.*` tracking host unchanged.

## API quirks
- Email body must be **HTML** (not plain text with newlines) — the API silently drops plain-text bodies on both POST and PATCH. Convert: `\n\n` → `</p><p>`, `\n` → `<br>`.
- Creating a campaign with sequences in the POST body saves the step structure (subjects, delays) but NOT the bodies. Always follow with a PATCH to set bodies.
- Timezone enum is undocumented. Known working value: `"Etc/GMT+12"` (same as existing RIA Wire campaign). Other IANA names (America/Los_Angeles, US/Pacific, etc.) are rejected.
- Campaign status: 0 = draft/not-launched, 2 = paused, 1 = active. Create at 0 or 2; activate manually after review.

## 5-effort sequence structure
Delays: Day 0, +1, +1, +2, +3 (= E5 lands on Day 7 from lead add).
- E1 (Day 0): The Wedge — cold intro + hot vs cold leads
- E2 (Day 1): Problem agitation — rented lists vs fresh signals
- E3 (Day 2): Proof — job-posting method story
- E4 (Day 4): Full offer stack + guarantee
- E5 (Day 7): Deadline close

Copy source: `marketing/cold-campaign-draft1.txt` (publisher-locked; update [DATE TOKEN] per campaign).

## Rolling deadline offer rule (Karilyn's instruction, Aug 2026)
Every new cold campaign batch gets a fresh deadline = the day E5 sends (Day 7 from lead-add date).
Offer is always: Founding Member price ($38/wk, $1,995/yr) + 3 free Special Reports.
When creating a new batch: replace [DATE TOKEN] in all 5 emails with the actual E5 date before loading into Instantly.

## Campaign settings
- `stop_on_reply: true` (lead exits sequence on any reply)
- `open_tracking: false` (better cold deliverability)
- `first_email_text_only: true` (E1 renders as plain text to the recipient's client)
- `prioritize_new_leads: true`
- Schedule: weekdays only, 08:00–18:00

## Daily sending ramp
- DO NOT set `daily_limit` on campaigns. Instantly slow-ramp is enabled at the account level on karilyn@hollywoodsaleswires.com — it handles ramping automatically up to 50/day. A campaign-level cap overrides and starves it.
- Mailbox settings: 50/day limit, slow ramp on, warmup running (1/day increase, 10/day cap, 30% reply rate). Same on karilyn@ria-wires.com.
- `dailyLimit` column in cold_campaigns DB stores 50 (mailbox ceiling) for reference only — not sent to Instantly.
- Plan cap: 40 prospect leads max per batch (Growth plan, shared with RIA Wire; ~49 slots remain as of Aug 2026).

## Automation safety rule
Claim each launch date durably before creating anything in Instantly. If a run
stops partway through, reconcile by exact campaign name and resume the same
provider campaign; never create another campaign merely because the process
restarted.

**Why:** Process-local date guards do not survive deployments and can multiply
active campaigns, duplicate outreach, and damage sender reputation.

**How to apply:** Every automated campaign creator must use a durable unique
launch key plus provider reconciliation before any create call.
