import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { address, createSolanaRpcFromTransport } from "@solana/kit";

import { getWalletTokens, WALLET_TOKENS, type FetchPrices, type WalletRpc } from "../lib/wallet.js";

const OWNER = address("9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo");
const OTHER = address("D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV");
const [SKR, USDC] = WALLET_TOKENS.map((t) => t.mint);

const tokenAccount = (mint: string, owner: string, amount: string) => ({
  pubkey: OTHER,
  account: {
    executable: false,
    lamports: 2039280n,
    owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    rentEpoch: 0n,
    space: 165n,
    data: {
      program: "spl-token",
      space: 165,
      parsed: { type: "account", info: { mint, owner, tokenAmount: { amount, decimals: 6 } } },
    },
  },
});

function fakeRpc(accounts: Record<string, unknown[]>, fail = false): WalletRpc {
  return createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: [string, { mint: string }] };
    if (fail) throw new Error("RPC down");
    assert.equal(method, "getTokenAccountsByOwner");
    const [, { mint }] = params;
    return { jsonrpc: "2.0", id, result: { context: { slot: 1 }, value: accounts[mint] ?? [] } } as never;
  });
}

const prices: FetchPrices = async () => ({
  [SKR]: { usdPrice: 0.02, priceChange24h: -3 },
  [USDC]: { usdPrice: 1, priceChange24h: 0.01 },
});

describe("wallet tokens", () => {
  it("returns zero balances for an empty wallet", async () => {
    const tokens = await getWalletTokens(fakeRpc({}), OWNER, prices);
    assert.deepEqual(
      tokens.map((t) => [t.symbol, t.amount, t.usdPrice]),
      [
        ["SKR", "0", 0.02],
        ["USDC", "0", 1],
      ],
    );
  });

  it("sums every token account of the same mint without precision loss", async () => {
    const tokens = await getWalletTokens(
      fakeRpc({
        [SKR]: [tokenAccount(SKR, OWNER, "9007199254740993"), tokenAccount(SKR, OWNER, "7")],
        [USDC]: [tokenAccount(USDC, OWNER, "2242620")],
      }),
      OWNER,
      prices,
    );
    assert.equal(tokens[0].amount, "9007199254741000");
    assert.equal(tokens[1].amount, "2242620");
  });

  it("ignores accounts for another owner or mint", async () => {
    const tokens = await getWalletTokens(
      fakeRpc({ [SKR]: [tokenAccount(SKR, OTHER, "5"), tokenAccount(USDC, OWNER, "6")] }),
      OWNER,
      prices,
    );
    assert.equal(tokens[0].amount, "0");
  });

  it("keeps balances when prices are unavailable", async () => {
    const tokens = await getWalletTokens(
      fakeRpc({ [USDC]: [tokenAccount(USDC, OWNER, "1000000")] }),
      OWNER,
      async () => {
        throw new Error("price API down");
      },
    );
    assert.equal(tokens[1].amount, "1000000");
    assert.equal(tokens[1].usdPrice, null);
    assert.equal(tokens[1].priceChange24h, null);
  });

  it("propagates RPC failures instead of reporting empty balances", async () => {
    await assert.rejects(getWalletTokens(fakeRpc({}, true), OWNER, prices));
  });
});
