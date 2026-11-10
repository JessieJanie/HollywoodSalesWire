---
name: Stripe live connection & payment links
description: How to reach the live Stripe account and which payment links exist
---
Live Stripe account `acct_1TyKnC8TDFH4346h` is connected. Multiple Stripe connections exist — pick the one whose `settings.secret` starts with `sk_live`/`rk_live`.

**Access pattern:** `getClient()`/`proxyFetch` do NOT work for Stripe here ("Unrecognized request URL" via proxy). Use CodeExecution `"use impure"` + `listConnections("stripe")` + the connection's `settings.secret` + direct fetch to `api.stripe.com`.

Current publisher-supplied checkout links (Nov 10, 2026):
- Individual founding $299/year: https://buy.stripe.com/14A28q3254if9R5ghP3ks0e
- Individual founding $32.50/month: https://buy.stripe.com/3cI14mbyB9Cz4wL2qZ3ks0f
- Team founding $599/year: https://buy.stripe.com/eVqbJ07il6qn0gv3v33ks0g
- Team founding $64.99/month: https://buy.stripe.com/6oU6oG5adaGDd3h1mV3ks0h
- Individual regular $575/year: https://buy.stripe.com/8x2bJ0fOR3eb7IX8Pn3ks0i
- Team regular $1,150/year: https://buy.stripe.com/9B6dR87il5mjfbp0iR3ks0j

Do not delete or deactivate old Stripe prices or payment links. These six publisher-supplied URLs returned HTTP 200, but the connected production Stripe link listing did not include them as of Nov 10, 2026; the listing contained older links. Use the supplied URLs in site code without inventing replacements, and verify the correct Stripe account before any Stripe-side change.
