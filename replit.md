# Hollywood Sales Wire

Subscription sales site for Hollywood Sales Wire — a long-form sales letter, order page with Stripe Payment Link checkout, thank-you page, and legal pages.

## Run & Operate

- Site: `artifacts/hollywood-sales-wire` (previewPath `/`), workflow `artifacts/hollywood-sales-wire: web`
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/scripts run sync-github -- "message"` — push site changes to GitHub (JessieJanie/HollywoodSalesWire, main). Run after every change to the site.

## Stack

- Static React (Vite) frontend only — no backend or database in use. Checkout happens on Stripe Payment Links.
- pnpm workspaces, TypeScript, Tailwind v4, wouter, shadcn-style UI

## Where things live

- Site source: `artifacts/hollywood-sales-wire/src` (pages: SalesPage `/`, OrderPage `/order`, ThanksPage `/thanks`, legal `/terms` `/privacy` `/refund-policy`)
- Pricing, deadline, Stripe checkout links: `artifacts/hollywood-sales-wire/src/lib/constants.ts`
- GitHub sync script: `scripts/src/sync-github.ts`

## Architecture decisions

- Site was imported verbatim from GitHub repo `JessieJanie/HollywoodSalesWire`; only the sync roots (`src/`, `public/`, `index.html`) are pushed back — the repo keeps its own standalone package.json/vite.config.
- No backend: subscriptions run through Stripe Payment Links (currently TEST-mode links in constants.ts; owner will swap to live links).

## Product

- Founding rate: $1,995/yr ($38/wk) → regular $3,995/yr ($77/wk). Team: $4,995 founding / $9,995 regular.
- 90-Day Money-Back Guarantee (exact phrase). Support: hello@hollywoodsaleswire.com.
- Launch deadline shown on site: Tuesday, August 4 (constants.ts).

## User preferences

- **All copy is locked by the publisher.** Do not rewrite, "improve," or expand any copy, pricing, guarantee wording, or claims. Only make changes the user explicitly asks for.
- Every change to the site must be pushed to the GitHub repo `JessieJanie/HollywoodSalesWire`.

## Gotchas

- After any site change, run the sync-github script so GitHub stays current.
- Custom domain: hollywoodsaleswire.com (DNS on Cloudflare; A + TXT records, DNS-only/gray-cloud) — owner attaches after publishing.
