---
name: Stripe live connection status
description: Where the Stripe live-mode setup stands and what remains before real payments work
---

The site's checkout runs on Stripe Payment Links; `CHECKOUT_LINKS` in the web artifact's constants file still holds TEST-mode links.

**State (as of July 28, 2026):** The Replit Stripe connector is bound only to the user's SANDBOX account (`listConnections("stripe")` returns an `sk_test_` key, "Hollywood Sales Wire Sandbox"). The user submitted live-account activation (bank + identity) but Stripe's review was pending, so installing the Replit app on the live account failed / the live account was unselectable in the install picker.

**Remaining steps:**
1. User installs the Replit app on the LIVE account (Replit Tools → Integrations → Stripe → step 3). Verify via `listConnections` that the key is `sk_live_`/`rk_live_` and account name has no "Sandbox".
2. Then create two yearly recurring products + payment links in live mode ($1,995/yr founding individual, $4,995/yr team 5 seats) — agent can do this via the connector once live.
3. Swap the two URLs into `CHECKOUT_LINKS`, sync to GitHub, user Republishes.

**Why:** Everything the user built earlier kept landing in the sandbox because the live account was never connected; don't create products until the connector shows a live key.
