import { address, createSolanaRpc, type Address, type GetTokenAccountsByOwnerApi, type Rpc } from "@solana/kit";

import { JUPITER_API_KEY, SOLANA_MAINNET_RPC_URL } from "./config.js";

// https://docs.solanamobile.com/solana-mobile-stack/skr
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const WALLET_TOKENS = [
  { mint: address("SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3"), symbol: "SKR", decimals: 6 },
  { mint: address("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), symbol: "USDC", decimals: 6 },
] as const;

export type WalletRpc = Rpc<GetTokenAccountsByOwnerApi>;
export type FetchPrices = (mints: Address[]) => Promise<Record<string, Price>>;
export type Price = { usdPrice: number; priceChange24h: number | null };

export type WalletToken = {
  mint: Address;
  symbol: string;
  decimals: number;
  amount: string;
  usdPrice: number | null;
  priceChange24h: number | null;
};

const PRICE_URL = "https://api.jup.ag/price/v3";
const PRICE_TIMEOUT_MS = 4000;

export function createWalletRpc(): WalletRpc {
  return createSolanaRpc(SOLANA_MAINNET_RPC_URL);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Raw base-unit balance of `mint` summed across every token account `owner` holds for it. */
export async function tokenBalance(rpc: WalletRpc, owner: Address, mint: Address): Promise<bigint> {
  const { value } = await rpc.getTokenAccountsByOwner(owner, { mint }, { encoding: "jsonParsed" }).send();
  let total = 0n;
  for (const { account } of value) {
    const parsed = isObject(account.data) && isObject(account.data.parsed) ? account.data.parsed : null;
    const info = parsed && isObject(parsed.info) ? parsed.info : null;
    const amount = info && isObject(info.tokenAmount) ? info.tokenAmount.amount : undefined;
    if (info?.mint === mint && info.owner === owner && typeof amount === "string") total += BigInt(amount);
  }
  return total;
}

// https://developers.jup.ag/docs/price/index.md
export const fetchJupiterPrices: FetchPrices = async (mints) => {
  const response = await fetch(`${PRICE_URL}?ids=${mints.join(",")}`, {
    headers: JUPITER_API_KEY ? { "x-api-key": JUPITER_API_KEY } : {},
    signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`price API returned ${response.status}`);
  const body: unknown = await response.json();
  const prices: Record<string, Price> = {};
  if (!isObject(body)) return prices;
  for (const mint of mints) {
    const entry = body[mint];
    if (!isObject(entry) || typeof entry.usdPrice !== "number" || !Number.isFinite(entry.usdPrice)) continue;
    const change = entry.priceChange24h;
    prices[mint] = {
      usdPrice: entry.usdPrice,
      priceChange24h: typeof change === "number" && Number.isFinite(change) ? change : null,
    };
  }
  return prices;
};

/** Balances are required; prices are best-effort and come back null when unavailable. */
export async function getWalletTokens(
  rpc: WalletRpc,
  owner: Address,
  fetchPrices: FetchPrices = fetchJupiterPrices,
): Promise<WalletToken[]> {
  const mints = WALLET_TOKENS.map((token) => token.mint);
  const [balances, prices] = await Promise.all([
    Promise.all(mints.map((mint) => tokenBalance(rpc, owner, mint))),
    fetchPrices(mints).catch((error: unknown) => {
      console.error("Price lookup failed", error);
      return {} as Record<string, Price>;
    }),
  ]);
  return WALLET_TOKENS.map((token, i) => ({
    ...token,
    amount: balances[i].toString(),
    usdPrice: prices[token.mint]?.usdPrice ?? null,
    priceChange24h: prices[token.mint]?.priceChange24h ?? null,
  }));
}
