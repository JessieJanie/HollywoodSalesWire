import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertPublicPricingConsistency } from "../src/lib/publicPricing.ts";

const artifactRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const publicDir = path.join(artifactRoot, "dist", "public");
const [indexHtml, llmsText, pricingJson] = await Promise.all([
  readFile(path.join(publicDir, "index.html"), "utf8"),
  readFile(path.join(publicDir, "llms.txt"), "utf8"),
  readFile(path.join(publicDir, "pricing.json"), "utf8"),
]);

assertPublicPricingConsistency(indexHtml, llmsText, pricingJson);
console.log("Built pricing assets match constants.ts.");
