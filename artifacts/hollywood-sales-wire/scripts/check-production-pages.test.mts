import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import {
  DEFAULT_ORIGIN,
  HOME_TITLE,
  checkPage,
  publisherAlertSuccessMessage,
  resolveOrigin,
  type PageExpectation,
} from './check-production-pages.mts';

const expected: PageExpectation = {
  path: '/article',
  title: 'Article title',
  renderedBody: `<main>${'route-specific body '.repeat(30)}</main>`,
};
const canonicalOrigin = new URL('https://canonical.example');
let server: Server;
let origin: URL;

function html({
  title = expected.title,
  canonical = new URL(expected.path.slice(1), canonicalOrigin).href,
  body = expected.renderedBody,
} = {}): string {
  return `<!doctype html><html><head><title>${title}</title><link rel="canonical" href="${canonical}"></head><body>${body}</body></html>`;
}

before(async () => {
  server = createServer((request, response) => {
    const validHtml = html({
      canonical: new URL((request.url ?? '/').replace(/^\//, ''), canonicalOrigin).href,
    });
    switch (request.url) {
      case '/pass':
        response.end(validHtml);
        break;
      case '/http':
        response.writeHead(503, 'Unavailable');
        response.end(validHtml);
        break;
      case '/title':
        response.end(html({ title: 'Wrong title' }));
        break;
      case '/canonical':
        response.end(html({ canonical: 'https://wrong.example/article' }));
        break;
      case '/body':
        response.end(html({ body: '<main>wrong body</main>' }));
        break;
      case '/home-shell':
        response.end(html({ title: HOME_TITLE }));
        break;
      case '/timeout':
        setTimeout(() => response.end(validHtml), 200);
        break;
      default:
        response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  origin = new URL(`http://127.0.0.1:${address.port}`);
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function failuresFor(route: string, page = expected, timeoutMs = 500): Promise<string[]> {
  return checkPage({ ...page, path: route }, origin, canonicalOrigin, timeoutMs);
}

test('accepts valid crawler HTML', async () => {
  assert.deepEqual(await failuresFor('/pass'), []);
});

test('reports an HTTP failure and accepts a successful status', async () => {
  assert.match((await failuresFor('/http')).join('\n'), /HTTP 503 Unavailable/);
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /HTTP/);
});

test('reports a malformed title and accepts the expected title', async () => {
  assert.match((await failuresFor('/title')).join('\n'), /title was "Wrong title"/);
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /title was/);
});

test('reports a malformed canonical and accepts the expected canonical', async () => {
  assert.match((await failuresFor('/canonical')).join('\n'), /canonical was/);
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /canonical was/);
});

test('reports missing route body and accepts the rendered body', async () => {
  assert.match((await failuresFor('/body')).join('\n'), /body did not contain/);
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /body did not contain/);
});

test('reports a suspiciously short local render and accepts a substantial one', async () => {
  assert.match(
    (await failuresFor('/pass', { ...expected, renderedBody: 'short' })).join('\n'),
    /local server render was suspiciously short/,
  );
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /suspiciously short/);
});

test('reports a home-page shell on an inner route and accepts route-specific HTML', async () => {
  assert.match((await failuresFor('/home-shell')).join('\n'), /received the home-page shell/);
  assert.doesNotMatch((await failuresFor('/pass')).join('\n'), /home-page shell/);
});

test('reports request timeouts and accepts timely responses', async () => {
  await assert.rejects(failuresFor('/timeout', expected, 25), /aborted|timeout/i);
  await assert.doesNotReject(failuresFor('/pass'));
});

test('verified production uses the fixed origin without an override', () => {
  assert.equal(resolveOrigin(['--verified-production'], undefined).href, `${DEFAULT_ORIGIN}/`);
});

test('verified production blocks command-line and environment origin overrides', () => {
  assert.throws(
    () => resolveOrigin(['--verified-production', 'http://127.0.0.1:9999'], undefined),
    /remove the origin override/,
  );
  assert.throws(
    () => resolveOrigin(['--verified-production'], 'http://127.0.0.1:9999'),
    /remove the origin override/,
  );
});

test('configured production server gates the live check behind crawler fixtures', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts: Record<string, string> };
  const productionServer = await readFile(
    new URL('./serve-and-check-production.mts', import.meta.url),
    'utf8',
  );

  assert.match(
    packageJson.scripts['check:production:publish'],
    /^pnpm run test:crawler-check && .*check-production-pages\.mts --verified-production$/,
  );
  assert.match(
    productionServer,
    /spawn\('pnpm', \['run', 'check:production:publish'\]/,
  );
  assert.equal(
    packageJson.scripts['check:production'],
    'node --experimental-strip-types scripts/check-production-pages.mts',
  );
});

test('successful publisher alerts log only the Resend email ID', () => {
  assert.equal(
    publisherAlertSuccessMessage('email_123'),
    'Publisher alert sent (Resend email ID: email_123).',
  );
});
