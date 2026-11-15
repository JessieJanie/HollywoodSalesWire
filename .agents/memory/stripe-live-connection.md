---
name: Stripe live connection & payment links
description: How to reach the live Stripe account and which payment links exist
---
Live Stripe account `acct_1TyKnC8TDFH4346h` is connected. Multiple Stripe connections exist — pick the one whose `settings.secret` starts with `sk_live`/`rk_live`.

**Access pattern:** `getClient()`/`proxyFetch` do NOT work for Stripe here ("Unrecognized request URL" via proxy). Use CodeExecution `"use impure"` + `listConnections("stripe")` + the connection's `settings.secret` + direct fetch to `api.stripe.com`.

Current owner-approved checkout links (Nov 14, 2026):
- Individual founding $149/year: https://buy.stripe.com/7sY7sKdGJ1639R56Hf3ks0k
- Individual founding $16.25/month: https://buy.stripe.com/eVqbJ04692a70gvfdL3ks0l
- Team founding $299/year: https://buy.stripe.com/5kQ00ifOR2a76ET8Pn3ks0m
- Team founding $32.50/month: https://buy.stripe.com/eVq5kC9qteWTaV94z73ks0n
- Individual regular $289/year: https://buy.stripe.com/7sYdR88mp2a7e7l8Pn3ks0o
- Team regular $575/year: https://buy.stripe.com/eVqdR89qt9Cz6ETfdL3ks0p

Use these publisher-supplied current prices and URLs in code; do not modify Stripe or deactivate older prices/links unless explicitly asked.
