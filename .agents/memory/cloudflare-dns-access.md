---
name: Cloudflare DNS access
description: Agent has API access to edit DNS on all of Karilyn's Cloudflare zones
---
Secret `CLOUDFLARE_API_TOKEN` (added Aug 6 2026) is an "Edit zone DNS" token scoped to **all zones** in her Cloudflare account (hollywoodsaleswire.com, hollywoodsaleswires.com, ria-wire(s).com, radar-report(s).com, and others).

**Why:** She was doing DNS record edits by hand from screenshots; the token lets the agent make DNS changes directly via the Cloudflare API (use fetch in a "use impure" CodeExecution block).

**How to apply:** DNS records only — the token cannot manage Redirect Rules/page rules (needs a different permission; walk her through the dashboard for those). hollywoodsaleswires.com (plural) is the cold-email domain (Google Workspace + Instantly); keep its email records intact and any Instantly tracking-domain CNAME set to DNS-only (gray cloud).
