---
name: GitHub sync contract
description: Hollywood Sales Wire site mirrors to JessieJanie/HollywoodSalesWire; copy is locked.
---

The rule: after any change to the site under `artifacts/hollywood-sales-wire` (src/, public/, index.html), run `pnpm --filter @workspace/scripts run sync-github -- "message"` to push it to GitHub `JessieJanie/HollywoodSalesWire@main` via the GitHub connector (Git Data API — the workspace monorepo is NOT git-linked to that repo).

**Why:** The owner requires every change to land in their GitHub repo; the repo layout is a standalone Vite app, so pushing the whole monorepo would destroy it — only sync roots are mirrored.

**How to apply:** Change site files → typecheck → run sync script. Never edit sales copy, pricing, guarantee wording, or claims without an explicit user request (publisher-locked).
