import type { FoundingDeadline } from "./foundingDeadline";

export type PublicOfferBanner = "loading" | "founding" | "neutral";

/**
 * A founding banner is shown only for a valid, still-open ?d= link.
 * A missing, malformed, or expired date is the regular page, with no
 * "this founding offer has ended" banner.
 */
export function publicOfferBanner(deadline: FoundingDeadline | null | undefined): PublicOfferBanner {
  if (!deadline) return "loading";
  if (deadline.overrideDate && !deadline.closed) return "founding";
  return "neutral";
}
