// Founding Payment Links are the URLs at
// /api/founding-checkout?source=cold
// redirects to while that server deadline
// is open. The page decides open vs
// closed in the browser and links here
// directly, appending a valid ?d= when
// the visitor arrived with one.
export const CHECKOUT_LINKS = {
  INDIVIDUAL_REGULAR: "https://buy.stripe.com/8x2bJ0fOR3eb7IX8Pn3ks0i",
  TEAM_REGULAR: "https://buy.stripe.com/9B6dR87il5mjfbp0iR3ks0j",
  INDIVIDUAL_FOUNDING: "https://buy.stripe.com/14A28q3254if9R5ghP3ks0e",
  TEAM_FOUNDING: "https://buy.stripe.com/eVqbJ07il6qn0gv3v33ks0g",
  INDIVIDUAL_FOUNDING_MONTHLY: "https://buy.stripe.com/3cI14mbyB9Cz4wL2qZ3ks0f",
  TEAM_FOUNDING_MONTHLY: "https://buy.stripe.com/6oU6oG5adaGDd3h1mV3ks0h",
};

export const FOUNDING_OFFER_PATH = "/founding-offer";
export const FOUNDING_DEADLINE_PARAM = "d";

export const SUPPORT_EMAIL = "hello@hollywoodsaleswire.com";
export const REGULAR_RATE_YR = 575;
export const FOUNDING_RATE_YR = 299;
export const FOUNDING_RATE_MONTHLY = 32.5;

export const TEAM_REGULAR_RATE_YR = 1150;
export const TEAM_FOUNDING_RATE_YR = 599;
export const TEAM_FOUNDING_RATE_MONTHLY = 64.99;

export const REPORTS_VALUE = 357;
export const SPECIAL_REPORT_VALUE = REPORTS_VALUE / 3;
