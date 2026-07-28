/**
 * Sync the Hollywood Sales Wire site files from artifacts/hollywood-sales-wire
 * back to the GitHub repo JessieJanie/HollywoodSalesWire (main branch).
 *
 * Uses the Replit GitHub connector (Git Data API via authenticated proxy).
 * Run: pnpm --filter @workspace/scripts run sync-github [-- "commit message"]
 *
 * Only site content files are synced (src/, public/, index.html). The repo's
 * own package.json / vite.config.ts / tsconfig.json stay untouched so it
 * remains a standalone Vite app.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ReplitConnectors } from "@replit/connectors-sdk";

const OWNER = "JessieJanie";
const REPO = "HollywoodSalesWire";
const BRANCH = "main";
const ARTIFACT_DIR = join(process.cwd(), "..", "artifacts", "hollywood-sales-wire");
const SYNC_ROOTS = ["src", "public", "index.html"];

const connectors = new ReplitConnectors();

async function gh(path: string, init?: { method?: string; body?: unknown }) {
  const res = await connectors.proxy("github", path, {
    method: init?.method ?? "GET",
    ...(init?.body !== undefined
      ? {
          body: JSON.stringify(init.body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });
  if (!res.ok) {
    throw new Error(`GitHub ${init?.method ?? "GET"} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<any>;
}

function collectFiles(root: string): string[] {
  const abs = join(ARTIFACT_DIR, root);
  const st = statSync(abs, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isFile()) return [abs];
  const out: string[] = [];
  for (const entry of readdirSync(abs)) {
    out.push(...collectFiles(join(root, entry)));
  }
  return out;
}

async function main() {
  const message = process.argv[2] ?? "Sync site updates from Replit";

  const ref = await gh(`/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
  const headSha: string = ref.object.sha;
  const headCommit = await gh(`/repos/${OWNER}/${REPO}/git/commits/${headSha}`);

  const files = SYNC_ROOTS.flatMap((r) => collectFiles(r));
  const tree = files.map((absPath) => ({
    path: relative(ARTIFACT_DIR, absPath).split("\\").join("/"),
    mode: "100644" as const,
    type: "blob" as const,
    content: readFileSync(absPath, "utf8"),
  }));

  const newTree = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
    method: "POST",
    body: { base_tree: headCommit.tree.sha, tree },
  });

  if (newTree.sha === headCommit.tree.sha) {
    console.log("No changes to sync — GitHub repo is already up to date.");
    return;
  }

  const commit = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
    method: "POST",
    body: { message, tree: newTree.sha, parents: [headSha] },
  });

  await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: "PATCH",
    body: { sha: commit.sha },
  });

  console.log(`Pushed commit ${commit.sha} to ${OWNER}/${REPO}@${BRANCH}: ${message}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
