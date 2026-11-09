import {
  CHECKOUT_LINKS,
  FOUNDING_DEADLINE_PARAM,
  FOUNDING_OFFER_PATH,
  FOUNDING_RATE_MONTHLY,
  FOUNDING_RATE_YR,
  REGULAR_RATE_YR,
  REPORTS_VALUE,
  SPECIAL_REPORT_VALUE,
  TEAM_FOUNDING_RATE_MONTHLY,
  TEAM_FOUNDING_RATE_YR,
  TEAM_REGULAR_RATE_YR,
} from "./constants.ts";

const formatPrice = (amount: number) => amount.toLocaleString("en-US");

export const PRICING_FAQ_ANSWER =
  `An individual membership is $${formatPrice(REGULAR_RATE_YR)} per year. ` +
  `A team membership (up to five readers) is $${formatPrice(TEAM_REGULAR_RATE_YR)} per year. ` +
  `Founding Member pricing offered through our valid offer links is $${formatPrice(FOUNDING_RATE_YR)}/year ` +
  `or $${formatPrice(FOUNDING_RATE_MONTHLY)}/month for an individual, and ` +
  `$${formatPrice(TEAM_FOUNDING_RATE_YR)}/year or $${formatPrice(TEAM_FOUNDING_RATE_MONTHLY)}/month ` +
  `for a Team of up to five seats. Every new membership is covered by a 90-day money-back guarantee.`;

export function createPublicPricingDocument(generatedAt = new Date().toISOString()) {
  return {
    individual: {
      regular: { annual: REGULAR_RATE_YR },
      founding: {
        annual: FOUNDING_RATE_YR,
        monthly: FOUNDING_RATE_MONTHLY,
      },
    },
    team: {
      regular: { annual: TEAM_REGULAR_RATE_YR, seats: 5 },
      founding: {
        annual: TEAM_FOUNDING_RATE_YR,
        monthly: TEAM_FOUNDING_RATE_MONTHLY,
        seats: 5,
      },
    },
    checkout_links: { ...CHECKOUT_LINKS },
    reports_value: REPORTS_VALUE,
    canonical_offer_path: FOUNDING_OFFER_PATH,
    deadline_param: FOUNDING_DEADLINE_PARAM,
    deadline_format: "YYYY-MM-DD",
    deadline_closes_at: "11:59 PM",
    deadline_timezone: "America/New_York",
    generated_at: generatedAt,
  };
}

export function generateLlmsPricingLines(template: string): string {
  const generatedLines = [
    `- Individual membership: $${formatPrice(REGULAR_RATE_YR)}/year.`,
    `- Team membership (up to 5 seats): $${formatPrice(TEAM_REGULAR_RATE_YR)}/year.`,
    `- Special Reports included with membership: The Spend Map, The $6.6 Billion Greenlight Window, and The Requisition Read ($${formatPrice(SPECIAL_REPORT_VALUE)} each; $${formatPrice(REPORTS_VALUE)} total value).`,
    `- Founding pricing: Individual $${formatPrice(FOUNDING_RATE_YR)}/year or $${formatPrice(FOUNDING_RATE_MONTHLY)}/month; Team $${formatPrice(TEAM_FOUNDING_RATE_YR)}/year or $${formatPrice(TEAM_FOUNDING_RATE_MONTHLY)}/month (up to 5 seats), available only through a valid, active offer link.`,
  ];
  const prefixes = [
    "- Individual membership:",
    "- Team membership (up to 5 seats):",
    "- Special Reports included with membership:",
    "- Founding pricing:",
  ];
  const lines = template.split("\n");

  for (let i = 0; i < prefixes.length; i += 1) {
    const matches = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => line.startsWith(prefixes[i]));
    if (matches.length !== 1) {
      throw new Error(`Expected one llms.txt price line starting with ${prefixes[i]}`);
    }
    lines[matches[0].index] = generatedLines[i];
  }

  return lines.join("\n");
}

type JsonObject = Record<string, unknown>;

function requireJsonObject(value: unknown, description: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Pricing generation: ${description} is missing or invalid`);
  }
  return value as JsonObject;
}

function findJsonObject(
  items: unknown[],
  predicate: (item: JsonObject) => boolean,
  description: string,
): JsonObject {
  const found = items
    .map((item) => requireJsonObject(item, description))
    .find(predicate);
  if (!found) throw new Error(`Pricing generation: could not find ${description}`);
  return found;
}

export function generateHomepageJsonLd(html: string): string {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) {
    throw new Error(`Expected one homepage JSON-LD script, found ${scripts.length}`);
  }

  const schema = requireJsonObject(JSON.parse(scripts[0][1]), "homepage JSON-LD") as JsonObject;
  const graph = schema["@graph"];
  if (!Array.isArray(graph)) throw new Error("Pricing generation: homepage JSON-LD has no @graph");

  const product = findJsonObject(
    graph,
    (item) => item["@type"] === "Product" && item.name === "Hollywood Sales Wire Membership",
    "membership Product",
  );
  if (!Array.isArray(product.offers)) {
    throw new Error("Pricing generation: membership Product has no offers");
  }
  const offers = product.offers.map((offer) => requireJsonObject(offer, "membership Offer"));
  const individual = findJsonObject(
    offers,
    (offer) => offer.name === "Individual Membership",
    "Individual Membership Offer",
  );
  const team = findJsonObject(
    offers,
    (offer) => offer.name === "Team Membership (up to 5 seats)",
    "Team Membership Offer",
  );

  individual.price = String(REGULAR_RATE_YR);
  individual.description = `$${formatPrice(REGULAR_RATE_YR)} per year. 52 weekly issues plus 12 monthly Divergence Reports, with a 90-day money-back guarantee.`;
  team.price = String(TEAM_REGULAR_RATE_YR);
  team.description = `$${formatPrice(TEAM_REGULAR_RATE_YR)} per year for up to 5 seats, with separate inbox deliveries and unified billing.`;

  const faqPage = findJsonObject(graph, (item) => item["@type"] === "FAQPage", "FAQPage");
  if (!Array.isArray(faqPage.mainEntity)) {
    throw new Error("Pricing generation: homepage FAQPage has no mainEntity");
  }
  const pricingQuestion = findJsonObject(
    faqPage.mainEntity,
    (item) => item.name === "How much does Hollywood Sales Wire cost?",
    "pricing FAQ question",
  );
  const acceptedAnswer = requireJsonObject(pricingQuestion.acceptedAnswer, "pricing FAQ answer");
  acceptedAnswer.text = PRICING_FAQ_ANSWER;

  const replacement = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
  return html.replace(scripts[0][0], replacement);
}

function readHomepageJsonLd(html: string): JsonObject {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (scripts.length !== 1) {
    throw new Error(`Expected one homepage JSON-LD script, found ${scripts.length}`);
  }
  return requireJsonObject(JSON.parse(scripts[0][1]), "homepage JSON-LD");
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Pricing consistency check failed: ${message}`);
}

export function assertPublicPricingConsistency(
  indexHtml: string,
  llmsText: string,
  pricingJsonText: string,
): void {
  const schema = readHomepageJsonLd(indexHtml);
  const graph = schema["@graph"];
  assert(Array.isArray(graph), "homepage JSON-LD has no @graph");

  const product = findJsonObject(
    graph,
    (item) => item["@type"] === "Product" && item.name === "Hollywood Sales Wire Membership",
    "membership Product",
  );
  assert(Array.isArray(product.offers), "membership Product has no offers");
  const offers = product.offers.map((offer) => requireJsonObject(offer, "membership Offer"));
  const individual = findJsonObject(
    offers,
    (offer) => offer.name === "Individual Membership",
    "Individual Membership Offer",
  );
  const team = findJsonObject(
    offers,
    (offer) => offer.name === "Team Membership (up to 5 seats)",
    "Team Membership Offer",
  );
  assert(individual.price === String(REGULAR_RATE_YR), "JSON-LD Individual Offer price differs from constants");
  assert(team.price === String(TEAM_REGULAR_RATE_YR), "JSON-LD Team Offer price differs from constants");

  const faqPage = findJsonObject(graph, (item) => item["@type"] === "FAQPage", "FAQPage");
  assert(Array.isArray(faqPage.mainEntity), "homepage FAQPage has no mainEntity");
  const pricingQuestion = findJsonObject(
    faqPage.mainEntity,
    (item) => item.name === "How much does Hollywood Sales Wire cost?",
    "pricing FAQ question",
  );
  const acceptedAnswer = requireJsonObject(pricingQuestion.acceptedAnswer, "pricing FAQ answer");
  assert(acceptedAnswer.text === PRICING_FAQ_ANSWER, "JSON-LD pricing FAQ differs from visible FAQ copy");

  const expectedLlms = generateLlmsPricingLines(llmsText);
  assert(expectedLlms === llmsText, "llms.txt price lines differ from constants");

  const pricing = requireJsonObject(JSON.parse(pricingJsonText), "pricing.json");
  assert(typeof pricing.generated_at === "string", "pricing.json generated_at is missing");
  const generatedAt = pricing.generated_at;
  assert(
    new Date(generatedAt).toISOString() === generatedAt,
    "pricing.json generated_at is not an ISO timestamp",
  );
  const expectedPricing = createPublicPricingDocument(generatedAt);
  assert(
    JSON.stringify(pricing) === JSON.stringify(expectedPricing),
    "pricing.json values or checkout links differ from constants",
  );
}
