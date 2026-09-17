---
name: Diagnosing stalled Stripe checkout sessions
description: How to tell real prospect abandonment apart from internal test clicks when investigating unpaid/expired Stripe Checkout sessions.
---

# Diagnosing stalled Stripe Checkout sessions

Before concluding that stalled/expired Checkout Sessions represent real customers who saw
a price and backed out, check:

1. **`customer_details.email` / `customer_email`** — if null on every session, nobody got
   far enough to enter contact info. Real sticker-shock abandonment usually still happens
   after the page loads and shows the price, which can occur before email entry, but a
   pattern of *zero* emails across *all* sessions is also exactly what internal test clicks
   (open link, confirm it works, close tab) look like.
2. **Timing clusters vs. `payment_link` id** — session bursts within minutes/hours of a
   known internal event (a payment-link swap, a deploy, a manual QA pass) on the *same*
   `payment_link` strongly suggest testing, not organic traffic across days/weeks.
3. **Whether real marketing traffic could have reached checkout at all** — cross-check the
   actual lead/subscriber tables (e.g. cold-campaign `leads_uploaded` counts, newsletter
   subscriber `createdAt` dates vs. the funnel's day-N offer trigger) against the session
   dates. If no real lead/subscriber existed yet who could have reached the checkout link,
   the sessions are not evidence of prospect-side abandonment.

**Why:** conflating internal QA clicks with real customer drop-off leads to fixing the wrong
thing (e.g. chasing pricing-psychology theories) while a real but currently-dormant bug
(e.g. a broken CTA link) goes unaddressed until real traffic finally hits it.

**How to apply:** run this check first whenever asked to investigate "why isn't anyone
completing checkout" before proposing pricing/copy changes.
