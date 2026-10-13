// Founding Payment Links are the URLs /api/founding-checkout?source=cold
// redirects to while that server deadline is open. The page decides open vs
// closed in the browser and links here directly, appending a valid ?d= when
// the visitor arrived with one.
export const CHECKOUT_LINKS = {
  INDIVIDUAL_REGULAR: "https://buy.stripe.com/8x200dgk30anePL8nJ1VK02",
  TEAM_REGULAR: "https://buy.stripe.com/9B69AN9VFf5hfTPgUf1VK03",
  INDIVIDUAL_FOUNDING: "https://buy.stripe.com/7sYeV70l5bT5bDz47t1VK04",
  TEAM_FOUNDING: "https://buy.stripe.com/5kQfZb2td4qD373dI31VK05",
};
export const SUPPORT_EMAIL = "hello@hollywoodsaleswire.com";
export const REGULAR_RATE_YR = 3995;
export const FOUNDING_RATE_YR = 1995;

export const TEAM_REGULAR_RATE_YR = 9995;
export const TEAM_FOUNDING_RATE_YR = 4995;

export const REPORTS_VALUE = 1985;
