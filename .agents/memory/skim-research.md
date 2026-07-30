---
name: Skim research wallet & beat
description: How the paid Wire's automated research works — Skim (skim402.com) pay-per-read, wallet, working source URLs, known glitches.
---

# Skim research setup

- Wallet: address `0x74F22B62597B1283e6dab6147883E1eB0E395bDc` on Base; private key ONLY in Replit Secret `HSW_AGENT_PRIVATE_KEY`. Never print/move funds; ask Karilyn for top-ups. Skim is Karilyn's company — route feature requests through her.
- Client: `x402-axios` + `viem` in api-server. **Pin `x402-axios@1.2.0`** — 1.2.1 depends on unpublished `x402@^1.2.1` and fails to install (verified July 2026).
- Pattern: `withPaymentInterceptor(axios.create({ baseURL: "https://skim402.com/api", timeout: 90_000 }), privateKeyToAccount(env key))` then `POST /v1/read { url }` → `data.markdown`. ~$0.005/read, gasless.
- Errors: upstream 404/403 come back as HTTP 422 `{"error":"Upstream responded 4xx"}`.
- Research beat + house rules (receipts, primary sources, no paywalls/personal data) are in `attached_assets/Pasted--Hello-Hollywood-we-re-setting-you-up-with-your-own-res_1785388808709.txt`.

## Verified working source URLs (July 2026)
- CA approved projects (the big one, ~6,800 words, all award rounds incl. newest): `https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/`
- NY quarterly reports index: `https://www.esd.ny.gov/esd-media-center/reports/film-tax-credit-2025-quarterly-reports` (links to PDFs; PDF reads work well)
- Deadline homepage reads fine (headlines only, ~220 words).

## Known glitches
- `film.ca.gov/tax-credit/` returns a thin staff-bio fragment (JS/tabbed page) — use the approved-projects URL instead.
- `georgia.org` → upstream 403 (bot-blocked). Need alternate GA source (Georgia Entertainment coverage / press releases).
- `jobs.netflix.com/search?...` → upstream 404 (SPA). Careers portals likely all need per-studio URL research or a custom Skim Signal.
