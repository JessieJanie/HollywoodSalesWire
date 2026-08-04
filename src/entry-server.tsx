/**
 * Server entry used only at build time by scripts/prerender.mts.
 *
 * Renders public routes to static HTML so AI crawlers and search engines
 * (which do not execute JavaScript) see the full page content. The client
 * bundle then hydrates/replaces this markup in the browser.
 */
import { renderToString } from 'react-dom/server';

import App from './App';
import { ARTICLES } from './lib/articles';

export function render(url: string): string {
  return renderToString(<App ssrPath={url} />);
}

export interface PrerenderRoute {
  path: string;
  title: string;
  description: string;
}

const SITE_TITLE = 'Hollywood Sales Wire';

/** Public routes to prerender. Gated/private pages are deliberately excluded. */
export function getPrerenderRoutes(): PrerenderRoute[] {
  return [
    // "/" keeps the meta already baked into index.html (title/description untouched).
    {
      path: '/order',
      title: `Subscribe — ${SITE_TITLE}`,
      description:
        'Subscribe to Hollywood Sales Wire — a weekly sales-intelligence briefing for vendors selling into the entertainment industry. Monthly and annual plans.',
    },
    {
      path: '/articles',
      title: `Articles — ${SITE_TITLE}`,
      description:
        'Essays and field notes on selling into the entertainment industry: tax-credit awards, entity formations, hiring signals, and how production money actually moves.',
    },
    ...ARTICLES.map((a) => ({
      path: `/articles/${a.slug}`,
      title: `${a.title} — ${SITE_TITLE}`,
      description: a.description,
    })),
    {
      path: '/faq',
      title: `FAQ — ${SITE_TITLE}`,
      description:
        'Frequently asked questions about Hollywood Sales Wire: what it is, what it costs, where the leads come from, and how it compares to lead databases.',
    },
    {
      path: '/support',
      title: `Support — ${SITE_TITLE}`,
      description:
        'Get help with your Hollywood Sales Wire membership: delivery, billing, and account questions.',
    },
    {
      path: '/terms',
      title: `Terms of Service — ${SITE_TITLE}`,
      description: 'Hollywood Sales Wire terms of service.',
    },
    {
      path: '/privacy',
      title: `Privacy Policy — ${SITE_TITLE}`,
      description: 'Hollywood Sales Wire privacy policy.',
    },
    {
      path: '/refund-policy',
      title: `Refund Policy — ${SITE_TITLE}`,
      description: 'Hollywood Sales Wire refund policy.',
    },
  ];
}
