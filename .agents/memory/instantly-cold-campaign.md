---
name: Instantly cold email campaign setup
description: How HSW cold outreach campaigns are structured in Instantly, including API quirks and the rolling-deadline offer pattern.
---

# Instantly Cold Email Campaign

## Account
- Sending mailbox: `karilyn@hollywoodsaleswires.com` (note the extra 's' — different domain from the site)
- Second mailbox in account: `karilyn@ria-wires.com` (for RIA Wire, not HSW)
- Both fully warmed (score 100) as of Aug 2026, daily limit 30 each
- Org ID: `eb13be48-1e9c-40d9-ad9a-697f9d7e257b`
- API: `https://api.instantly.ai/api/v2`, Bearer auth via `INSTANTLY_API_KEY` secret

## API quirks
- Email body must be **HTML** (not plain text with newlines) — the API silently drops plain-text bodies on both POST and PATCH. Convert: `\n\n` → `</p><p>`, `\n` → `<br>`.
- Creating a campaign with sequences in the POST body saves the step structure (subjects, delays) but NOT the bodies. Always follow with a PATCH to set bodies.
- Timezone enum is undocumented. Known working value: `"Etc/GMT+12"` (same as existing RIA Wire campaign). Other IANA names (America/Los_Angeles, US/Pacific, etc.) are rejected.
- Campaign status: 0 = draft/not-launched, 2 = paused, 1 = active. Create at 0 or 2; activate manually after review.

## Current campaigns
- RIA Wire AI SDR: `e0618bad-911d-4a09-965b-7f532d88a5ec` (AI SDR, uses template variable bodies)
- HSW Cold Batch 1: `78856448-f0db-4b86-b963-233ff7a331f8` (deadline Aug 25, status 0/draft, paused for review)

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

## Programmatic lead upload
- `cold_campaigns` DB table tracks: campaign_id, batch_tag, deadline, daily_limit, leads_uploaded, created_at.
- `createColdBatch()` now queries batch count for ramp, adds `daily_limit` to POST, stores row in DB.
- `uploadColdLeads(leads: ColdLead[])` in `coldCampaigns.ts` — uploads array to Instantly, enforces cap, updates DB.
- `POST /publisher/cold-leads` (key-auth) — accepts `{leads: [{email, first_name?, last_name?, company?}]}`.
- `GET /publisher/cold-campaign` (key-auth, query param) — returns current campaign status and remaining slots.
- Lead upload: one POST /leads call per lead (known-working); Instantly bulk endpoint untested.
- lib/db requires `npx tsc --build` in lib/db/ after any schema change (project references, emitDeclarationOnly).

## Prospect list
- Not yet built. Plan: use Skim research to build targeting vendors selling into entertainment production (catering, AV, security, equipment, stage services, production tech).
- UTM tags: `utm_source=cold&utm_medium=email&utm_campaign=hsw-cold-1&utm_content=e1` (increment campaign number per batch).

## How new campaign batches work (fully automated now)
1. Scheduler fires Tue/Wed/Thu 8am PT → calls createColdBatch().
2. Batch count queried from cold_campaigns → daily_limit selected from ramp array.
3. Campaign POSTed with daily_limit, PATCHed with bodies, activated, monitor lead enrolled, DB row inserted.
4. To add prospect leads: POST /publisher/cold-leads with key + leads array (no Instantly UI needed).
5. RIA Wire agent or Karilyn can call /publisher/cold-leads to upload the prospect list.
