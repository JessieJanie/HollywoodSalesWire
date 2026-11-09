import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertPublicPricingConsistency,
  createPublicPricingDocument,
  generateHomepageJsonLd,
  generateLlmsPricingLines,
} from "../src/lib/publicPricing.ts";

const artifactRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const indexPath = path.join(artifactRoot, "index.html");
const llmsPath = path.join(artifactRoot, "public", "llms.txt");
const pricingPath = path.join(artifactRoot, "public", "pricing.json");

const [indexTemplate, llmsTemplate] = await Promise.all([
  readFile(indexPath, "utf8"),
  readFile(llmsPath, "utf8"),
]);

const generatedAt = new Date().toISOString();
const generatedIndex = generateHomepageJsonLd(indexTemplate);
const generatedLlms = generateLlmsPricingLines(llmsTemplate);
const pricingJson = `${JSON.stringify(createPublicPricingDocument(generatedAt), null, 2)}\n`;

await Promise.all([
  writeFile(indexPath, generatedIndex),
  writeFile(llmsPath, generatedLlms),
  writeFile(pricingPath, pricingJson),
]);

assertPublicPricingConsistency(generatedIndex, generatedLlms, pricingJson);
console.log("Generated homepage JSON-LD, llms.txt pricing, and public/pricing.json from constants.ts.");
