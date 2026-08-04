import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';

import './index.css';

const container = document.getElementById('root')!;

// Production pages are prerendered to static HTML at build time (for crawlers
// that don't run JavaScript). Hydrate that markup when present; otherwise do a
// normal client render (dev server, non-prerendered routes).
if (container.hasChildNodes()) {
  hydrateRoot(container, <App />);
} else {
  createRoot(container).render(<App />);
}
