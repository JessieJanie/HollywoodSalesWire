---
name: Site prerendering for AI/search crawlers
description: Why public HSW pages are prerendered to static HTML and the one live behavior that needs verification.
---

# Site prerendering (GEO)

- Public pages (home, /order, /articles + each article, /support, legal) are prerendered to static HTML at build time so non-JS crawlers (ChatGPT fetchers, etc.) see full text and pricing. Members-only content is deliberately never prerendered; Karilyn declined public "new formations" pages — subscriber-only info.
- **Why:** the site is a Vite SPA; served HTML was an empty root div — invisible to AI fetchers that don't run JS.
- **How to apply:** any new public page/article must be added to the prerender route list (entry-server) and sitemap.xml (manually maintained). Client hydrates only when the page's canonical path matches the URL — SPA-fallback-served routes get a fresh client render instead (avoids hydration mismatch).
- **Unverified until a Republish:** static host must serve `dist/public/<route>/index.html` ahead of the `/* -> /index.html` rewrite. Task exists to curl-verify in prod; if the rewrite wins, per-route serving needs rework.
