/**
 * Build-time prerendering.
 *
 * Runs after `vite build` (client) + `vite build --ssr` (server entry).
 * For each public route it renders the app to HTML, injects the markup into
 * the built index.html shell, swaps per-route <title>/description/canonical,
 * and writes dist/public/<route>/index.html. The static host serves these
 * files directly, so crawlers that don't run JavaScript get the full text.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(root, 'dist', 'public');
const ssrEntry = path.join(root, 'dist', 'ssr', 'entry-server.js');

const { render, getPrerenderRoutes } = await import(
  pathToFileURL(ssrEntry).href
);

const template = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
const ROOT_DIV = '<div id="root"></div>';
if (!template.includes(ROOT_DIV)) {
  throw new Error('prerender: could not find <div id="root"></div> in index.html');
}

const SITE_ORIGIN = 'https://hollywoodsaleswire.com';

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: could not find ${what} in index.html`);
  return html.replace(pattern, replacement);
}

// 1. Prerender the home page in place (keeps its existing meta/JSON-LD).
{
  const appHtml = render('/');
  if (appHtml.length < 500) throw new Error('prerender: "/" rendered suspiciously little HTML');
  writeFileSync(
    path.join(publicDir, 'index.html'),
    template.replace(ROOT_DIV, `<div id="root">${appHtml}</div>`),
  );
  console.log(`prerendered / (${appHtml.length} bytes of markup)`);
}

// 2. Prerender every other public route with route-specific meta.
for (const route of getPrerenderRoutes()) {
  const appHtml = render(route.path);
  if (appHtml.length < 500) {
    throw new Error(`prerender: ${route.path} rendered suspiciously little HTML — check the route`);
  }
  const title = escapeHtml(route.title);
  const desc = escapeHtml(route.description);
  const canonical = `${SITE_ORIGIN}${route.path}`;

  let html = template;
  // Drop the homepage-wide Organization/Product/FAQ JSON-LD graph on other
  // routes: pages emit their own page-appropriate JSON-LD via React (FAQ,
  // press releases), and homepage schema on unrelated pages is misleading
  // structured data.
  html = replaceOnce(
    html,
    /[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/,
    '',
    'homepage JSON-LD block',
  );
  html = replaceOnce(html, /<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, '<title>');
  html = replaceOnce(
    html,
    /<meta name="description" content="[^"]*" \/>/,
    `<meta name="description" content="${desc}" />`,
    'meta description',
  );
  html = replaceOnce(
    html,
    /<link rel="canonical" href="[^"]*" \/>/,
    `<link rel="canonical" href="${canonical}" />`,
    'canonical link',
  );
  html = html
    .replace(/(<meta property="og:title" content=")[^"]*(" \/>)/, `$1${title}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(" \/>)/, `$1${desc}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(" \/>)/, `$1${canonical}$2`)
    .replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/, `$1${title}$2`)
    .replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/, `$1${desc}$2`);
  html = html.replace(ROOT_DIV, `<div id="root">${appHtml}</div>`);

  const outDir = path.join(publicDir, ...route.path.split('/').filter(Boolean));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, 'index.html'), html);
  console.log(`prerendered ${route.path} (${appHtml.length} bytes of markup)`);
}

console.log('prerender: done');
