---
name: Skim research wallet & beat
description: How the paid Wire's automated research works — Skim (skim402.com) pay-per-read, wallet, working source URLs, known glitches.
---

# Skim research setup

- Wallet: address `0x74F22B62597B1283e6dab6147883E1eB0E395bDc` on Base; private key ONLY in Replit Secret `HSW_AGENT_PRIVATE_KEY`. Never print/move funds; ask Karilyn for top-ups. Skim is Karilyn's company — route feature requests through her.
- Client: `x402-axios` + `viem` in api-server. **Pin `x402-axios@1.2.0`** — 1.2.1 depends on unpublished `x402@^1.2.1` and fails to install (verified July 2026).
- Pattern: `withPaymentInterceptor(axios.create({ baseURL: "https://skim402.com/api", timeout: 90_000 }), privateKeyToAccount(env key))` then `POST /v1/read { url }` → `data.markdown`. ~$0.005/read, gasless.
- Errors: upstream 404/403 come back as HTTP 422 `{"error":"Upstream responded 4xx"}`. Failed reads are never charged (confirmed by Skim July 30, 2026).
- Every read returns `wordCount` + THIN_CONTENT warnings. For JS-tabbed pages, `POST /v1/read/js` ($0.005) forces a browser render — pipeline auto-falls back to it when a plain read is under 60 words.
- Custom Signals LIVE (verified with paid polls July 30, 2026): `GET /v2/signal/film-incentives/latest` and `GET /v2/signal/studio-jobs/latest`. Third Signal `entity-formations` announced Aug 3, 2026 — live at next skim402.com publish; NY+TX only (CA needs CALICO account signup — Karilyn's to-do; GA/NM bot-walled); use publishedAt not filingDate for freshness (TX future-dates); dedupe by registry ID; expect non-film noise, pipeline does second-pass relevance. UK Companies House LIVE Aug 3, 2026 (NM also observed in feed); feed returns only ~100 newest items GLOBALLY and ignores jurisdiction params (limit=500 still returns 100) — high UK volume (91/100 seen) can crowd out US filings; per-jurisdiction quotas = upstream feature request via Karilyn (task exists). Reading rules in wireResearch.ts tell the model to treat missing US items as unknown, not zero. **Both require the v2 client** (@x402/fetch + @x402/core + @x402/evm) — x402-axios 1.2.0 throws (`accepts.map` undefined) on v2 payment challenges, despite Skim's note saying axios works for incentives. Pipeline polls both each run, skips gracefully when down. A live-but-unauth signal returns 402; a 404 means not deployed. Job-count reading rules: per-term per-studio trends only; never sum terms or compare across studios.
- California SOS rejected the CALICO publication-records request and directed the publisher to BizFile. Official BizFile help materials say Business Entity bulk orders include free weekly data unloads. Treat this as the priority workaround: verify a stable download route and schema before recurring use. A usable source must provide a bounded recent range, initial filing/formation date, and stable entity ID or official record URL; reject Agents exports and amendment-only lists.
- Research beat + house rules (receipts, primary sources, no paywalls/personal data) are in `attached_assets/Pasted--Hello-Hollywood-we-re-setting-you-up-with-your-own-res_1785388808709.txt`.

## Verified working source URLs (July 2026)
- CA approved projects (the big one, ~6,800 words, all award rounds incl. newest): `https://film.ca.gov/film-and-television-tax-credit-program-approved-projects-list/`
- NY quarterly reports index: `https://www.esd.ny.gov/esd-media-center/reports/film-tax-credit-2025-quarterly-reports` (links to PDFs; PDF reads work well)
- Deadline homepage reads fine (headlines only, ~220 words).

## Known glitches
- CA approved-projects page: webFetch/Skim markdown only captures the table's first 10 visible rows. The FULL archive (~900 rows, FY2009-10→present) is embedded in the raw HTML — `curl` the page and parse `<tr>`/`<td>` directly. Free, no paid read needed.
- `film.ca.gov/tax-credit/` returns a thin staff-bio fragment (JS/tabbed page) — use the approved-projects URL instead.
- `georgia.org` → upstream 403 (bot-blocked). Working alternate (added to beat Aug 4, 2026): `https://www.georgiaentertainment.com/news/` — covers GA film office announcements/direct-spend updates. `gov.georgia.gov/press-releases` loads but article links aren't in plain HTML.
- `jobs.netflix.com/search?...` → upstream 404 (SPA). Careers portals likely all need per-studio URL research or a custom Skim Signal.
