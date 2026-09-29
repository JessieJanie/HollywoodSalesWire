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

/**
 * v2 fetch-with-payment client for Signal endpoints. The v1 axios
 * interceptor cannot parse v2 payment challenges (verified: throws on
 * `accepts.map`), so all /v2/signal/* calls go through this.
 */
async function v2Fetch(url: string): Promise<unknown> {
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
  const res = await fetchWithPay(url, { method: "GET", signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`Signal fetch ${url}: HTTP ${res.status}`);
  return res.json();
}

/** State incentive award rounds & incentive press (CA, NY, GA, NM, TX). */
export async function skimFilmIncentives(limit = 50): Promise<IncentiveItem[]> {
  const data = await v2Fetch(`https://skim402.com/api/v2/signal/film-incentives/latest?limit=${limit}`);
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
  const data = (await v2Fetch(
    `https://skim402.com/api/v2/signal/studio-jobs/latest?limit=${limit}`,
  )) as { items?: StudioJobsItem[]; crawl?: { status?: string } };
  return { items: data.items ?? [], crawlStatus: data.crawl?.status };
}

export interface EntityFormationItem {
  title?: string;
  url?: string;
  summary?: string;
  payload: {
    entityName: string;
    jurisdiction: string;
    country: string;
    filingDate: string;
    entityNumber: string;
    entityType: string;
    registeredAgent?: string | null;
    sourceUrl: string;
    official: boolean;
    publishedAt: string;
  };
}

/**
 * New film/TV-adjacent entity formations (LLCs etc.) from official registries.
 * Coverage: US state registries (NY/TX/NM) + UK Companies House + Canada (ON
 * observed), rebalanced as of Sept 2026 — the ~100 newest items now split
 * roughly evenly across jurisdictions instead of UK volume crowding out the
 * rest. Jurisdiction query params are still ignored (verified).
 * (CA/GA are bot-walled — known gaps, not failures,
 * so crawl.status stays "ok"; degradedSources means an existing source itself broke).
 * Keyword-filtered upstream with word boundaries; expect non-film noise —
 * caller must do second-pass relevance judgment. Dedupe is by registry ID.
 * Use payload.publishedAt for freshness (TX filingDate can be future-dated).
 * Refreshes every 6h — poll at most once or twice a day.
 */
export async function skimEntityFormations(
  limit = 100,
): Promise<{ items: EntityFormationItem[]; crawlStatus?: string; degradedSources?: string[] }> {
  const data = (await v2Fetch(
    `https://skim402.com/api/v2/signal/entity-formations/latest?limit=${limit}`,
  )) as { items?: EntityFormationItem[]; crawl?: { status?: string; degradedSources?: string[] } };
  return {
    items: data.items ?? [],
    crawlStatus: data.crawl?.status,
    degradedSources: data.crawl?.degradedSources,
  };
}
