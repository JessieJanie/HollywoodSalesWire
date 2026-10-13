---
name: GitHub sync contract
description: Hollywood Sales Wire site mirrors to JessieJanie/HollywoodSalesWire; copy is locked.
---

The rule: after any change to the site under `artifacts/hollywood-sales-wire` (src/, public/, index.html), run `pnpm --filter @workspace/scripts run sync-github -- "message"` to push it to GitHub `JessieJanie/HollywoodSalesWire@main` via the GitHub connector (Git Data API — the workspace monorepo is NOT git-linked to that repo).

**Why:** The owner requires every change to land in their GitHub repo; the repo layout is a standalone Vite app, so pushing the whole monorepo would destroy it — only sync roots are mirrored.

**How to apply:** Change site files → typecheck → run sync script. Never edit sales copy, pricing, guarantee wording, or claims without an explicit user request (publisher-locked).

For an incoming GitHub pull, compare against the last outbound sync and import the newer site changes into the frontend artifact, preserving the monorepo's backend and build configuration. Do not merge the standalone repository at the workspace root.

**Why:** The histories and directory layouts differ. Historical GitHub copies of binary images also differ from local originals because the outbound sync treats files as UTF-8; blindly replacing all assets would risk corrupting working images.

**How to apply:** Check the incoming commit diff and required imports, preserve unchanged local binary assets, and adapt only package/test-runner integration needed by the workspace.
