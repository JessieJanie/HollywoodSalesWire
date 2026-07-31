---
name: Stripe live connection & payment links
description: How to reach the live Stripe account and which payment links exist
---
Live Stripe account `acct_1TyKnC8TDFH4346h` is connected. Multiple Stripe connections exist — pick the one whose `settings.secret` starts with `sk_live`/`rk_live`.

**Access pattern:** `getClient()`/`proxyFetch` do NOT work for Stripe here ("Unrecognized request URL" via proxy). Use CodeExecution `"use impure"` + `listConnections("stripe")` + the connection's `settings.secret` + direct fetch to `api.stripe.com`.

Payment links (all live, annual recurring):
- Regular individual $3,995/yr: https://buy.stripe.com/8x200dgk30anePL8nJ1VK02 (public order page)
- Regular team $9,995/yr: https://buy.stripe.com/9B69AN9VFf5hfTPgUf1VK03 (public order page)
- Founding individual $1,995/yr: https://buy.stripe.com/7sYeV70l5bT5bDz47t1VK04 (server-side only, behind /api/founding-checkout)
- Founding team $4,995/yr: https://buy.stripe.com/5kQfZb2td4qD373dI31VK05 (server-side only)
- OLD founding links (bJebIVgk37CP9vravR1VK00 individual, 8x2dR3c3N0an3737jF1VK01 team) were deactivated in Stripe on July 31, 2026 after the new site went live.
