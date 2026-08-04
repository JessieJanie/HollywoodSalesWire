import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';

import './index.css';

const container = document.getElementById('root')!;

// Production pages are prerendered to static HTML at build time (for crawlers
// that don't run JavaScript). Only hydrate when the prerendered markup actually
// belongs to the current URL — non-prerendered routes (/shelf, /publisher, …)
// are served the home page's HTML by the SPA fallback rewrite, and hydrating
// that would mismatch. Each prerendered page carries a canonical link whose
// path identifies which route its markup is for.
const normalize = (p: string) => (p.replace(/\/+$/, '') === '' ? '/' : p.replace(/\/+$/, ''));
const canonicalHref = document
  .querySelector('link[rel="canonical"]')
  ?.getAttribute('href');
const prerenderedPath = canonicalHref ? normalize(new URL(canonicalHref).pathname) : null;
const currentPath = normalize(window.location.pathname);

if (container.hasChildNodes() && prerenderedPath === currentPath) {
  hydrateRoot(container, <App />);
} else {
  container.replaceChildren();
  createRoot(container).render(<App />);
}
