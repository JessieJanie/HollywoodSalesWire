/**
 * Smoke-check crawler-visible production HTML after a publish.
 *
 * Usage:
 *   pnpm --filter @workspace/hollywood-sales-wire check:production
 *   pnpm --filter @workspace/hollywood-sales-wire check:production -- http://localhost:4173
 *   pnpm --filter @workspace/hollywood-sales-wire check:production -- --verified-production
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ORIGIN = 'https://hollywoodsaleswire.com';
const canonicalOrigin = new URL(process.env.CANONICAL_ORIGIN ?? DEFAULT_ORIGIN);
const HOME_TITLE =
  'Hollywood Sales Wire — Weekly Entertainment Industry Sales Leads &amp; Buying Signals';

interface PageExpectation {
  path: string;
  title: string;
  renderedBody: string;
}

interface PrerenderRoute {
  path: string;
  title: string;
}

interface ServerEntry {
  render: (path: string) => string;
  getPrerenderRoutes: () => PrerenderRoute[];
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ssrEntry = path.join(root, 'dist', 'ssr', 'entry-server.js');
const { render, getPrerenderRoutes } = (await import(pathToFileURL(ssrEntry).href)) as ServerEntry;

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const pages: PageExpectation[] = [
  {
    path: '/',
    title: HOME_TITLE,
    renderedBody: render('/'),
  },
  ...getPrerenderRoutes().map((route) => ({
    path: route.path,
    title: escapeHtml(route.title),
    renderedBody: render(route.path),
  })),
];

const arguments_ = process.argv.slice(2).filter((argument) => argument !== '--');
const verifiedProduction = arguments_.includes('--verified-production');
const originArgument = arguments_.find((argument) => argument !== '--verified-production');

if (verifiedProduction && (originArgument || process.env.PRODUCTION_ORIGIN)) {
  throw new Error(
    'The automatic publish check must use the verified production URL; remove the origin override.',
  );
}

const origin = new URL(
  verifiedProduction ? DEFAULT_ORIGIN : (originArgument ?? process.env.PRODUCTION_ORIGIN ?? DEFAULT_ORIGIN),
);
origin.pathname = '/';
origin.search = '';
origin.hash = '';

function canonicalHref(html: string): string | undefined {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
}

function titleText(html: string): string | undefined {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
}

async function checkPage(expected: PageExpectation): Promise<string[]> {
  const url = new URL(expected.path.replace(/^\//, ''), origin);
  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'HSW-Crawler-Smoke-Check/1.0 (no JavaScript)',
    },
    signal: AbortSignal.timeout(15_000),
  });
  const html = await response.text();
  const failures: string[] = [];
  const actualTitle = titleText(html);
  const actualCanonical = canonicalHref(html);
  const expectedCanonical = new URL(expected.path.replace(/^\//, ''), canonicalOrigin).href;

  if (!response.ok) {
    failures.push(`HTTP ${response.status} ${response.statusText}`);
  }
  if (actualTitle !== expected.title) {
    failures.push(`title was ${JSON.stringify(actualTitle)}, expected ${JSON.stringify(expected.title)}`);
  }
  if (actualCanonical !== expectedCanonical) {
    failures.push(
      `canonical was ${JSON.stringify(actualCanonical)}, expected ${JSON.stringify(expectedCanonical)}`,
    );
  }
  if (expected.renderedBody.length < 500) {
    failures.push(`local server render was suspiciously short (${expected.renderedBody.length} bytes)`);
  } else if (!html.includes(expected.renderedBody)) {
    failures.push(
      `body did not contain its route-specific server render (${expected.renderedBody.length} bytes)`,
    );
  }
  if (expected.path !== '/' && actualTitle === HOME_TITLE) {
    failures.push('received the home-page shell instead of route-specific HTML');
  }

  return failures;
}

console.log(`Checking crawler-visible HTML at ${origin.origin}`);

let failed = false;
for (const page of pages) {
  try {
    const failures = await checkPage(page);
    if (failures.length === 0) {
      console.log(`PASS ${page.path}`);
      continue;
    }

    failed = true;
    console.error(`FAIL ${page.path}`);
    for (const failure of failures) console.error(`  - ${failure}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${page.path}`);
    console.error(`  - request failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  console.error('Production crawler smoke check failed.');
  process.exitCode = 1;
} else {
  console.log('Production crawler smoke check passed.');
}