/**
 * Skim (skim402.com) pay-per-read web reader client.
 * Pays ~$0.005/read in USDC on Base via x402; wallet key lives ONLY in the
 * HSW_AGENT_PRIVATE_KEY secret. Lazy-imported so a missing key can never
 * take down unrelated endpoints.
 */

type SkimClient = {
  post: (path: string, body: unknown) => Promise<{ data: { markdown?: string } }>;
  get: (path: string, config?: { params?: Record<string, string | number> }) => Promise<{ data: unknown }>;
};

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

/** Browser-rendered read ($0.005) — recovers JS-tabbed pages the plain read misses. */
export async function skimReadJs(url: string): Promise<SkimResult> {
  const skim = await getClient();
  const { data } = await skim.post("/v1/read/js", { url });
  const markdown = data.markdown ?? "";
  return { markdown, wordCount: markdown.split(/\s+/).filter(Boolean).length };
}

// ---------------------------------------------------------------------------
// Custom Skim Signals (paid structured feeds, $0.005/poll)
// ---------------------------------------------------------------------------

export interface IncentiveItem {
  kind: string;
  title: string;
  summary: string;
  url: string;
  payload: {
    state: string;
    stateName: string;
    official: boolean;
    outlet: string;
    publishedAt: string;
  };
}

/** State incentive award rounds & incentive press (CA, NY, GA, NM, TX). */
export async function skimFilmIncentives(limit = 50): Promise<IncentiveItem[]> {
  const skim = await getClient();
  const { data } = await skim.get("/v2/signal/film-incentives/latest", { params: { limit } });
  const items = (data as { items?: IncentiveItem[] })?.items;
  return Array.isArray(items) ? items : [];
}

export interface StudioJobsItem {
  payload: {
    counts: Record<string, number>;
    week: string;
    capturedAt: string;
  };
  [key: string]: unknown;
}

/**
 * Weekly AI/content-ops job-posting counts across five studio job boards.
 * Uses the v2 x402 client (Signal endpoints are v2; the axios interceptor
 * only speaks v1 payments for /v1/read).
 */
export async function skimStudioJobs(limit = 100): Promise<{ items: StudioJobsItem[]; crawlStatus?: string }> {
  const key = process.env.HSW_AGENT_PRIVATE_KEY;
  if (!key) throw new Error("HSW_AGENT_PRIVATE_KEY is not set");
  const [{ wrapFetchWithPayment }, { x402Client }, { ExactEvmScheme, toClientEvmSigner }, viem, { privateKeyToAccount }, { base }] =
    await Promise.all([
      import("@x402/fetch"),
      import("@x402/core/client"),
      import("@x402/evm"),
      import("viem"),
      import("viem/accounts"),
      import("viem/chains"),
    ]);
  const account = privateKeyToAccount(key as `0x${string}`);
  const wallet = viem
    .createWalletClient({ account, chain: base, transport: viem.http("https://mainnet.base.org") })
    .extend(viem.publicActions);
  const signer = toClientEvmSigner(
    { address: account.address, signTypedData: (m: never) => account.signTypedData(m) },
    wallet,
  );
  const client = new x402Client().register("eip155:8453", new ExactEvmScheme(signer));
  const fetchWithPay = wrapFetchWithPayment(fetch, client);
  const res = await fetchWithPay(
    `https://skim402.com/api/v2/signal/studio-jobs/latest?limit=${limit}`,
    { method: "GET", signal: AbortSignal.timeout(120_000) },
  );
  if (!res.ok) throw new Error(`studio-jobs signal: HTTP ${res.status}`);
  const data = (await res.json()) as { items?: StudioJobsItem[]; crawl?: { status?: string } };
  return { items: data.items ?? [], crawlStatus: data.crawl?.status };
}
