// Founding Payment Links are the URLs at
// /api/founding-checkout?source=cold
// redirects to while that server deadline
// is open. The page decides open vs
// closed in the browser and links here
// directly, appending a valid ?d= when
// the visitor arrived with one.
export const CHECKOUT_LINKS = {
  INDIVIDUAL_REGULAR: "https://buy.stripe.com/bJe8wO4696qn6ET2qZ3ks0a",
  TEAM_REGULAR: "https://buy.stripe.com/00wbJ0dGJdSPaV94z73ks0b",
  INDIVIDUAL_FOUNDING: "https://buy.stripe.com/aFa9AScCF163d3h5Db3ks06",
  TEAM_FOUNDING: "https://buy.stripe.com/bJe00i7ilaGD8N1e9H3ks08",
  INDIVIDUAL_FOUNDING_MONTHLY: "https://buy.stripe.com/cNicN45adeWT4wLc1z3ks07",
  TEAM_FOUNDING_MONTHLY: "https://buy.stripe.com/9B6fZg1Y1cOL2oD3v33ks09",
};

export const SUPPORT_EMAIL = "hello@hollywoodsaleswire.com";
export const REGULAR_RATE_YR = 1150;
export const FOUNDING_RATE_YR = 599;
export const FOUNDING_RATE_MONTHLY = 64.99;

export const TEAM_REGULAR_RATE_YR = 2300;
export const TEAM_FOUNDING_RATE_YR = 1198;
export const TEAM_FOUNDING_RATE_MONTHLY = 129.98;

export const REPORTS_VALUE = 1985;
