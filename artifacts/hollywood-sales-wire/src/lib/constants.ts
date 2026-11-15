// Founding Payment Links are the URLs at
// /api/founding-checkout?source=cold
// redirects to while that server deadline
// is open. The page decides open vs
// closed in the browser and links here
// directly, appending a valid ?d= when
// the visitor arrived with one.
export const CHECKOUT_LINKS = {
  INDIVIDUAL_REGULAR: "https://buy.stripe.com/7sYdR88mp2a7e7l8Pn3ks0o",
  TEAM_REGULAR: "https://buy.stripe.com/eVqdR89qt9Cz6ETfdL3ks0p",
  INDIVIDUAL_FOUNDING: "https://buy.stripe.com/7sY7sKdGJ1639R56Hf3ks0k",
  TEAM_FOUNDING: "https://buy.stripe.com/5kQ00ifOR2a76ET8Pn3ks0m",
  INDIVIDUAL_FOUNDING_MONTHLY: "https://buy.stripe.com/eVqbJ04692a70gvfdL3ks0l",
  TEAM_FOUNDING_MONTHLY: "https://buy.stripe.com/eVq5kC9qteWTaV94z73ks0n",
};

export const STRIPE_PRICE_ID_TO_PLAN = {
  price_1UbwwqCjWTn48pRoHGG6nCzB: "founding-individual",
  price_1UbwwwCjWTn48pRo8OXVY1Ml: "founding-individual",
  price_1UbwwzCjWTn48pRo8DqE2sZr: "founding-team",
  price_1Ubwx2CjWTn48pRoRULBKVjQ: "founding-team",
  price_1Ubwx4CjWTn48pRofxOj2fSO: "individual",
  price_1Ubwx7CjWTn48pRoAvPXoutu: "team",
  price_1Ua3JkCjWTn48pRokWP3FVKs: "founding-individual",
  price_1Ua3JmCjWTn48pRoAJENfOpp: "founding-individual",
  price_1Ua3JnCjWTn48pRojMu5s3hA: "founding-team",
  price_1Ua3JpCjWTn48pRoW4144Szn: "founding-team",
  price_1Ua3JqCjWTn48pRo1ZIb7DmH: "individual",
  price_1Ua3JrCjWTn48pRobKeTOcES: "team",
} as const;

export const FOUNDING_OFFER_PATH = "/founding-offer";
export const FOUNDING_DEADLINE_PARAM = "d";

export const SUPPORT_EMAIL = "hello@hollywoodsaleswire.com";
export const REGULAR_RATE_YR = 289;
export const FOUNDING_RATE_YR = 149;
export const FOUNDING_RATE_MONTHLY = 16.25;

export const TEAM_REGULAR_RATE_YR = 575;
export const TEAM_FOUNDING_RATE_YR = 299;
export const TEAM_FOUNDING_RATE_MONTHLY = 32.5;

export const REPORTS_VALUE = 357;
export const SPECIAL_REPORT_VALUE = REPORTS_VALUE / 3;
