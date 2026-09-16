/**
 * Smoke-check crawler-visible production HTML after a publish.
 *
 * Usage:
 *   pnpm --filter @workspace/hollywood-sales-wire check:production
 *   pnpm --filter @workspace/hollywood-sales-wire check:production -- http://localhost:4173
 *   pnpm --filter @workspace/hollywood-sales-wire check:production -- --verified-production
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ReplitConnectors } from '@replit/connectors-sdk';

export const DEFAULT_ORIGIN = 'https://hollywoodsaleswire.com';
export const HOME_TITLE =
  'Hollywood Sales Wire — Weekly Entertainment Industry Sales Leads &amp; Buying Signals';
const ALERT_RECIPIENT = 'hello@hollywoodsaleswire.com';
const ALERT_SENDER = 'Hollywood Sales Wire <briefings@hollywoodsaleswire.com>';

export interface PageExpectation {
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

export interface PageFailure {
  path: string;
  assertions: string[];
}

type ResendProxy = (
  connector: string,
  path: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<Response>;

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function resolveOrigin(
  arguments_: string[],
  productionOrigin = process.env.PRODUCTION_ORIGIN,
): URL {
  const filteredArguments = arguments_.filter((argument) => argument !== '--');
  const verifiedProduction = filteredArguments.includes('--verified-production');
  const originArgument = filteredArguments.find((argument) => argument !== '--verified-production');

  if (verifiedProduction && (originArgument || productionOrigin)) {
    throw new Error(
      'The automatic publish check must use the verified production URL; remove the origin override.',
    );
  }

  const origin = new URL(
    verifiedProduction ? DEFAULT_ORIGIN : (originArgument ?? productionOrigin ?? DEFAULT_ORIGIN),
  );
  origin.pathname = '/';
  origin.search = '';
  origin.hash = '';
  return origin;
}

function canonicalHref(html: string): string | undefined {
  const tag = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i)?.[0];
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1];
}

function titleText(html: string): string | undefined {
  return html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
}

function alertIdempotencyKey(failures: PageFailure[]): string {
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(failures))
    .digest('hex')
    .slice(0, 32);
  return `crawler-check-failed-${fingerprint}`;
}

function escapeAlertHtml(value: string): string {
  return escapeHtml(value).replaceAll('\n', '<br>');
}

export function publisherAlertSuccessMessage(emailId: string): string {
  return `Publisher alert sent (Resend email ID: ${emailId}).`;
}

export async function notifyPublisher(
  failures: PageFailure[],
  proxy: ResendProxy = (connector, proxyPath, init) =>
    new ReplitConnectors().proxy(connector, proxyPath, init),
): Promise<string> {
  const summary = failures.flatMap(({ path, assertions }) =>
    assertions.map((assertion) => `${path}: ${assertion}`),
  );
  const response = await proxy('resend', '/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': alertIdempotencyKey(failures),
    },
    body: JSON.stringify({
      from: ALERT_SENDER,
      to: [ALERT_RECIPIENT],
      subject: `Crawler check failed on ${failures.length} route${failures.length === 1 ? '' : 's'}`,
      text: `The live crawler check failed:\n\n${summary.map((line) => `- ${line}`).join('\n')}`,
      html: `<p>The live crawler check failed:</p><ul>${summary
        .map((line) => `<li>${escapeAlertHtml(line)}</li>`)
        .join('')}</ul>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
  }

  const { id } = (await response.json()) as { id: string };
  return id;
}

export async function checkPage(
  expected: PageExpectation,
  origin: URL,
  canonicalOrigin = new URL(process.env.CANONICAL_ORIGIN ?? DEFAULT_ORIGIN),
  timeoutMs = 15_000,
): Promise<string[]> {
  const url = new URL(expected.path.replace(/^\//, ''), origin);
  const response = await fetch(url, {
    headers: {
      accept: 'text/html',
      'user-agent': 'HSW-Crawler-Smoke-Check/1.0 (no JavaScript)',
    },
    signal: AbortSignal.timeout(timeoutMs),
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

export async function main(arguments_ = process.argv.slice(2)): Promise<void> {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const ssrEntry = path.join(root, 'dist', 'ssr', 'entry-server.js');
  const { render, getPrerenderRoutes } = (await import(pathToFileURL(ssrEntry).href)) as ServerEntry;
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
  const origin = resolveOrigin(arguments_);
  const canonicalOrigin = new URL(process.env.CANONICAL_ORIGIN ?? DEFAULT_ORIGIN);
  const verifiedProduction = arguments_
    .filter((argument) => argument !== '--')
    .includes('--verified-production');

  console.log(`Checking crawler-visible HTML at ${origin.origin}`);

  const pageFailures: PageFailure[] = [];
  for (const page of pages) {
    try {
      const failures = await checkPage(page, origin, canonicalOrigin);
      if (failures.length === 0) {
        console.log(`PASS ${page.path}`);
        continue;
      }

      pageFailures.push({ path: page.path, assertions: failures });
      console.error(`FAIL ${page.path}`);
      for (const failure of failures) console.error(`  - ${failure}`);
    } catch (error) {
      const failure = `request failed: ${error instanceof Error ? error.message : String(error)}`;
      pageFailures.push({ path: page.path, assertions: [failure] });
      console.error(`FAIL ${page.path}`);
      console.error(`  - ${failure}`);
    }
  }

  if (pageFailures.length > 0) {
    console.error('Production crawler smoke check failed.');
    if (verifiedProduction) {
      try {
        const emailId = await notifyPublisher(pageFailures);
        console.error(publisherAlertSuccessMessage(emailId));
      } catch (error) {
        console.error(
          `Publisher alert failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    process.exitCode = 1;
  } else {
    console.log('Production crawler smoke check passed.');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}