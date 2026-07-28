# Hollywood Sales Wire — website

The complete Hollywood Sales Wire sales site: long-form sales letter (`/`), order page (`/order`), thank-you page (`/thanks`), and legal pages (`/terms`, `/privacy`, `/refund-policy`).

This is a **static React (Vite) site** — no backend, no database. Checkout happens on Stripe Payment Links.

## For the Replit Agent setting this project up

1. `npm install`, then run the dev server with `npm run dev` (serves on port 5000). Configure the workflow to run `npm run dev` and use webview output on port 5000.
2. **Publish as a Static deployment**: build command `npm run build`, public directory `dist`. Do NOT use autoscale/reserved-VM — there is no server.
3. The site is finished, fact-checked, and copy-locked. **Do not rewrite, "improve," or expand any copy** — pricing, guarantee wording, and claims are locked by the publisher. Only make changes the user explicitly asks for.
4. SPA routing: routes other than `/` must fall back to `index.html` (static deployments on Replit do this for single-page apps; if deep links 404, add a rewrite of `/*` to `/index.html` in the deployment config).

## Things the owner will do after deploy

- Attach the custom domain `hollywoodsaleswire.com` (DNS is on Cloudflare; A + TXT records, gray-cloud/DNS-only).
- Swap the Stripe TEST payment links in `src/lib/constants.ts` (`CHECKOUT_LINKS`) for live-mode links once the Stripe account is activated.

## Key facts (do not change without owner approval)

- Founding rate: $1,995/yr ($38/wk) → regular $3,995/yr ($77/wk). Team: $4,995 founding / $9,995 regular.
- 90-Day Money-Back Guarantee (exact phrase).
- Launch deadline shown on site: Tuesday, August 4 (in `src/lib/constants.ts`).
- Support email: hello@hollywoodsaleswire.com.
