---
name: Opt-in email sequence
description: How the 5-email preview series works and its constraints
---

- Opt-in only: cold outreach / scraped-prospect emailing was explicitly declined (July 2026); do not build it.
- Sends via the Resend connector from `briefings@hollywoodsaleswires.com` (the throwaway-spelling domain — the real hollywoodsaleswire.com is NOT verified in Resend yet).
- Emails are pre-scheduled at signup with Resend `scheduled_at` (days 1,2,3,6,7); unsubscribe cancels the remaining scheduled sends. No cron.
- **Why:** autoscale deployments can't run background timers reliably; Resend scheduling avoids that.
- Email copy in `emailSequence.ts` is [DRAFT] placeholder — publisher supplies final copy verbatim (site copy is publisher-locked; same rule applies to emails).
