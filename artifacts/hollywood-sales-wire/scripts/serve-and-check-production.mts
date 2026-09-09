import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRODUCTION_ORIGIN = 'https://hollywoodsaleswire.com';
const MARKER_PATH = '/__deployment-marker.txt';
const PROMOTION_TIMEOUT_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 2_000;
const PUBLIC_DIR = fileURLToPath(new URL('../dist/public/', import.meta.url));
const SPA_ROUTES = ['/shelf', '/publisher', '/founding-offer', '/thanks'];
const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};
const marker = (
  await readFile(new URL('../dist/public/__deployment-marker.txt', import.meta.url), 'utf8')
).trim();

async function resolveFile(pathname: string): Promise<string | undefined> {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const relativePath = normalizedPath.replace(/^[/\\]+/, '');
  const candidates = [
    join(PUBLIC_DIR, relativePath),
    join(PUBLIC_DIR, relativePath, 'index.html'),
  ];

  if (SPA_ROUTES.some((route) => decodedPath === route || decodedPath.startsWith(`${route}/`))) {
    candidates.push(join(PUBLIC_DIR, 'index.html'));
  }

  for (const candidate of candidates) {
    if (!candidate.startsWith(PUBLIC_DIR)) continue;
    try {
      if ((await stat(candidate)).isFile()) return candidate;
    } catch {
      // Try the next route representation.
    }
  }

  return undefined;
}

const server = createServer(async (request, response) => {
  try {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' }).end();
      return;
    }

    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    const file = await resolveFile(pathname);
    if (!file) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }

    response.writeHead(200, {
      'cache-control': file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600',
      'content-type': CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    createReadStream(file).pipe(response);
  } catch (error) {
    console.error('Static server request failed:', error);
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Server error');
  }
});

let shuttingDown = false;

function stop(exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  server.close(() => process.exit(exitCode));
}

process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());

const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`PORT must be a positive integer; received ${JSON.stringify(process.env.PORT)}.`);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Production server listening on port ${port}`);
});

async function waitForPromotion(): Promise<void> {
  const deadline = Date.now() + PROMOTION_TIMEOUT_MS;
  const markerUrl = new URL(MARKER_PATH, PRODUCTION_ORIGIN);

  console.log(`Waiting for ${PRODUCTION_ORIGIN} to serve deployment marker ${marker}`);

  while (Date.now() < deadline) {
    try {
      markerUrl.searchParams.set('build', marker);
      const response = await fetch(markerUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok && (await response.text()).trim() === marker) {
        console.log('Verified that the custom production domain is serving this deployment.');
        return;
      }
    } catch (error) {
      console.log(
        `Production promotion not visible yet: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Timed out waiting for ${PRODUCTION_ORIGIN} to serve this deployment after ${PROMOTION_TIMEOUT_MS / 60_000} minutes.`,
  );
}

async function runCrawlerCheck(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const check = spawn(
      process.execPath,
      ['--experimental-strip-types', 'scripts/check-production-pages.mts', '--verified-production'],
      {
        cwd: new URL('..', import.meta.url),
        env: process.env,
        stdio: 'inherit',
      },
    );

    check.on('error', reject);
    check.on('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Crawler check exited with ${signal ?? `code ${code ?? 1}`}.`));
    });
  });
}

void (async () => {
  try {
    await waitForPromotion();
    await runCrawlerCheck();
    console.log('Post-publish crawler verification passed.');
  } catch (error) {
    console.error('POST-PUBLISH CRAWLER VERIFICATION FAILED');
    console.error(error instanceof Error ? error.message : String(error));
    stop(1);
  }
})();