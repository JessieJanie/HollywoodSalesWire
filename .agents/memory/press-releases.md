---
name: Press releases as proof of "news first"
description: Purpose and rules for HSW press releases (/press page + ProductionHUB posts).
---

# Press releases — strategy

- Purpose (Karilyn, Aug 5, 2026): press releases showcase HSW finding production news **before the trades** — dated public "proofs" of the first-mover claim — while **never revealing the research strategy** (which registries/signals/tools are monitored, Skim, pipelines). Cite only the public primary source (e.g., Companies House number), not how it was found.
- Tone: news-first, subject-forward; HSW appears only in a short source note + media contact. She rejected promotional-sounding drafts.
- "First" claims must be verified literally true (web-search the subject for prior trade coverage before claiming it).
- Releases live in `src/lib/pressReleases.ts` (copy publisher-locked, mirrors what she posted externally, e.g. ProductionHUB); page /press + /press/:slug, prerendered + sitemap.
- First release: Doodle Girl Season 2 registry filings (posted to ProductionHUB Aug 5, 2026). If a trade later announces S2, the dated page is proof HSW called it first — marketing material.
- **Why:** the moat pitch is "we report it first"; these are the receipts. Leaking method would invite replication.
- **How to apply:** any future press release draft follows these rules; add new releases to pressReleases.ts on request.
