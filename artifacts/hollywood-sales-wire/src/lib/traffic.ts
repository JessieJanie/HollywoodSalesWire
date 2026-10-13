/**
 * Acquisition-source tracking for paid-ad tests (e.g. the SHOOT newsletter
 * banner). When a visitor lands with ?utm_source=... we remember a short slug
 * for the whole browser session, so it survives navigation from / to /order.
 *
 * - Free signups: the slug is sent with POST /api/subscribe and stored on the
 *   subscriber row.
 * - Paid checkouts: the slug is appended to the Stripe payment link as
 *   client_reference_id, which the webhook stores on the member row.
 *
 * The publisher console shows a per-source breakdown from these fields.
 */

const KEY = "hsw_source";

function sanitize(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
}

/** Call once on app load: captures utm_source into sessionStorage. */
export function captureTrafficSource(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("utm_source");
    if (!raw) return;
    const slug = sanitize(raw);
    if (slug) sessionStorage.setItem(KEY, slug);
  } catch {
    // sessionStorage unavailable (private mode edge cases) — tracking is best-effort.
  }
}

/** The remembered source slug for this browser session, or null. */
export function getTrafficSource(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * Append client_reference_id to a Stripe payment link so the completed
 * checkout carries the acquisition source into the webhook.
 */
export function withClientReference(stripeLink: string): string {
  const source = getTrafficSource();
  if (!source) return stripeLink;
  const sep = stripeLink.includes("?") ? "&" : "?";
  return `${stripeLink}${sep}client_reference_id=${encodeURIComponent(source)}`;
}
