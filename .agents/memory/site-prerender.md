---
name: Site prerendering for AI/search crawlers
description: Why public HSW pages are prerendered to static HTML and the one live behavior that needs verification.
---

# Site prerendering (GEO)

- Public pages (home, /order, /articles + each article, /support, legal) are prerendered to static HTML at build time so non-JS crawlers (ChatGPT fetchers, etc.) see full text and pricing. Members-only content is deliberately never prerendered; Karilyn declined public "new formations" pages — subscriber-only info.
- **Why:** the site is a Vite SPA; served HTML was an empty root div — invisible to AI fetchers that don't run JS.
- **How to apply:** any new public page/article must be added to the prerender route list (entry-server) and sitemap.xml (manually maintained). Client hydrates only when the page's canonical path matches the URL — SPA-fallback-served routes get a fresh client render instead (avoids hydration mismatch).
- **Verified Aug 7 2026:** Republish DOES rebuild (artifact.toml production.build runs the full build+prerender; env PORT/BASE_PATH come from services.env). But the static host applies rewrites BEFORE directory-index resolution — a catch-all `/* -> /index.html` rewrite hijacked every extensionless path and served the SPA shell to crawlers. Fix: artifact.toml rewrites now list ONLY the SPA-only routes (/founding-offer, /publisher, /thanks, /shelf + wildcards); public pages fall through to their prerendered `<route>/index.html`. Consequence: unknown URLs 404 at host level instead of the app's NotFound page. If a new gated/SPA-only route is added, it MUST be added to the rewrites list or it 404s in prod.
