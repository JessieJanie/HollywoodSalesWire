---
name: Instantly cold email campaign setup
description: Durable Instantly API quirks and campaign-safety rules for cold outreach.
---

# Instantly Cold Email Campaign


## Account safety
- Keep mailbox addresses, organization IDs, campaign IDs, and authentication details in secrets or live configuration, never in durable agent memory.
- Verify mailbox warmup and sending limits from Instantly before launch; historical values go stale.

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


## Rolling deadline offer rule
Every new cold campaign batch gets a fresh deadline = the day E5 sends (Day 7 from lead-add date).
Offer is always: Founding Member price ($38/wk, $1,995/yr) + 3 free Special Reports.
When creating a new batch: replace [DATE TOKEN] in all 5 emails with the actual E5 date before loading into Instantly.

## CTA links must land on a founding-verified page
Cold leads have no per-lead token/DB record (uploadColdLeads only pushes to Instantly, no local lead table), so their CTA links must point to `/founding-offer` (tokenless), which calls `GET /api/cold-offer` to check whether ANY recent cold-campaign batch's 7-day window is still open, then checkout goes through `/api/founding-checkout?source=cold` (server re-verifies before honoring the founding Stripe link).

**Why:** all 5 emails promise the $38/wk founding rate; a CTA pointing at the bare homepage/regular `/order` page silently reverts a cold-email prospect to the $77/wk regular rate with no path back to the promised price. Found Sept 2026 with all 14 cold-campaign batches created since Aug 18 having `leads_uploaded = 0` (no real prospect had ever actually been sent a cold email), so this bug hadn't yet caused a real loss — but would have as soon as leads were uploaded.

**How to apply:** any change to cold-campaign email copy/CTAs must keep the link as `/founding-offer?...` (existing UTM params fine), never a bare `/` or `/order` link.

## Campaign settings
- `stop_on_reply: true` (lead exits sequence on any reply)
- `open_tracking: false` (better cold deliverability)
- `first_email_text_only: true` (E1 renders as plain text to the recipient's client)
- `prioritize_new_leads: true`
- Schedule: weekdays only, 08:00–18:00

## Daily sending ramp
- Do not set `daily_limit` on campaigns when account-level slow ramp is enabled; a campaign-level cap overrides and can starve the account ramp.
- Verify current mailbox and plan limits from Instantly rather than relying on remembered values.

## Automation safety rule
Claim each launch date durably before creating anything in Instantly. If a run
stops partway through, reconcile by exact campaign name and resume the same
provider campaign; never create another campaign merely because the process
restarted.

**Why:** Process-local date guards do not survive deployments and can multiply
active campaigns, duplicate outreach, and damage sender reputation.

**How to apply:** Every automated campaign creator must use a durable unique
launch key plus provider reconciliation before any create call.
