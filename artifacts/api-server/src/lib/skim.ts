/**
 * Skim (skim402.com) pay-per-read web reader client.
 * Pays ~$0.005/read in USDC on Base via x402; wallet key lives ONLY in the
 * HSW_AGENT_PRIVATE_KEY secret. Lazy-imported so a missing key can never
 * take down unrelated endpoints.
 */

type SkimClient = { post: (path: string, body: unknown) => Promise<{ data: { markdown?: string } }> };

let clientPromise: Promise<SkimClient> | null = null;

async function getClient(): Promise<SkimClient> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const key = process.env.HSW_AGENT_PRIVATE_KEY;
      if (!key) throw new Error("HSW_AGENT_PRIVATE_KEY is not set");
      const [{ withPaymentInterceptor }, { privateKeyToAccount }, axios] = await Promise.all([
        import("x402-axios"),
        import("viem/accounts"),
        import("axios").then((m) => m.default),
      ]);
      const wallet = privateKeyToAccount(key as `0x${string}`);
      // Always set a timeout — a stalled payment step can otherwise hang forever.
      return withPaymentInterceptor(
        axios.create({ baseURL: "https://skim402.com/api", timeout: 90_000 }),
        wallet,
      ) as unknown as SkimClient;
    })();
    clientPromise.catch(() => { clientPromise = null; });
  }
  return clientPromise;
}

export interface SkimResult {
  markdown: string;
  wordCount: number;
}

export async function skimRead(url: string): Promise<SkimResult> {
  const skim = await getClient();
  const { data } = await skim.post("/v1/read", { url });
  const markdown = data.markdown ?? "";
  return { markdown, wordCount: markdown.split(/\s+/).filter(Boolean).length };
}
