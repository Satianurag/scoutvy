import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { address, createSolanaRpcFromTransport, getAddressDecoder, type Address } from "@solana/kit";

import type { Db } from "../lib/db.js";
import {
  findSgtMints,
  SGT_GROUP_ADDRESS,
  SGT_METADATA_ADDRESS,
  SGT_MINT_AUTHORITY,
  TOKEN_2022_PROGRAM_ADDRESS,
  type SgtRpc,
} from "../lib/sgt.js";
import { resolveTier } from "../lib/tier.js";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

const LEGACY_TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGLvCdXxDbT1rEAqG9dsKq6gbzVpgTsU";
const WALLET = address("9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo");
const OTHER_WALLET = address("D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV");
const REAL_SGT = address("Hg2s2QV98Bmec7ff4c1tHMUxWi21PvKc7eC7P6bG8dcR");
let counter = 0;
const fakeAddress = (): Address => address(`${"1".repeat(31)}${"23456789ABCDEFGH"[counter++ % 16]}`);

type MintOptions = {
  mintAuthority?: string | null;
  metadataAuthority?: string;
  metadataAddress?: string;
  group?: string;
  program?: string;
};

function mintAccount(mint: string, opts: MintOptions = {}) {
  return {
    executable: false,
    lamports: 2936240,
    owner: opts.program ?? TOKEN_2022_PROGRAM_ADDRESS,
    rentEpoch: 0,
    space: 450,
    data: {
      program: "spl-token-2022",
      space: 450,
      parsed: {
        type: "mint",
        info: {
          decimals: 0,
          freezeAuthority: SGT_MINT_AUTHORITY,
          isInitialized: true,
          mintAuthority: opts.mintAuthority === undefined ? SGT_MINT_AUTHORITY : opts.mintAuthority,
          supply: "1",
          extensions: [
            {
              extension: "metadataPointer",
              state: {
                authority: opts.metadataAuthority ?? SGT_MINT_AUTHORITY,
                metadataAddress: opts.metadataAddress ?? SGT_METADATA_ADDRESS,
              },
            },
            { extension: "groupMemberPointer", state: { authority: SGT_MINT_AUTHORITY, memberAddress: mint } },
            { extension: "tokenGroupMember", state: { group: opts.group ?? SGT_GROUP_ADDRESS, memberNumber: 1, mint } },
          ],
        },
      },
    },
  };
}

function tokenAccount(owner: string, mint: string, amount = "1") {
  return {
    pubkey: fakeAddress(),
    account: {
      executable: false,
      lamports: 2074080,
      owner: TOKEN_2022_PROGRAM_ADDRESS,
      rentEpoch: 0,
      space: 170,
      data: {
        program: "spl-token-2022",
        space: 170,
        parsed: {
          type: "account",
          info: {
            isNative: false,
            mint,
            owner,
            state: "initialized",
            tokenAmount: { amount, decimals: 0, uiAmount: Number(amount), uiAmountString: amount },
          },
        },
      },
    },
  };
}

type Chain = {
  tokenAccounts: Record<string, unknown[]>;
  mints: Record<string, unknown>;
  calls: { method: string; params: unknown[] }[];
  fail?: boolean;
};

function fakeRpc(chain: Chain): SgtRpc {
  return createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: unknown[] };
    chain.calls.push({ method, params });
    if (chain.fail) throw new Error("RPC down");
    const context = { slot: 1 };
    if (method === "getTokenAccountsByOwner") {
      const [owner] = params as [string];
      return { jsonrpc: "2.0", id, result: { context, value: chain.tokenAccounts[owner] ?? [] } } as never;
    }
    if (method === "getMultipleAccounts") {
      const [addresses] = params as [string[]];
      assert.ok(addresses.length <= 100, "getMultipleAccounts is limited to 100 addresses");
      return { jsonrpc: "2.0", id, result: { context, value: addresses.map((a) => chain.mints[a] ?? null) } } as never;
    }
    throw new Error(`unexpected ${method}`);
  });
}

async function createTestDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(schema);
  const db: Db = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
  };
  for (const wallet of [WALLET, OTHER_WALLET]) {
    await db.query("INSERT INTO users (wallet_address) VALUES ($1)", [wallet]);
  }
  return db;
}

describe("SGT verification", () => {
  let db: Db;
  let chain: Chain;
  let rpc: SgtRpc;

  beforeEach(async () => {
    db = await createTestDb();
    chain = { tokenAccounts: {}, mints: {}, calls: [] };
    rpc = fakeRpc(chain);
  });

  it("verifies a wallet holding a real SGT and queries Token-2022 accounts", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    assert.deepEqual(await resolveTier(db, rpc, WALLET), { tier: "verified_seeker", sgtMint: REAL_SGT });
    const [owner, filter, config] = chain.calls[0].params as [string, { programId: string }, { encoding: string }];
    assert.equal(owner, WALLET);
    assert.equal(filter.programId, TOKEN_2022_PROGRAM_ADDRESS);
    assert.equal(config.encoding, "jsonParsed");
  });

  it("returns unverified for a wallet with no Token-2022 accounts", async () => {
    assert.deepEqual(await resolveTier(db, rpc, WALLET), { tier: "unverified", reason: "no_sgt" });
  });

  for (const [name, opts] of [
    ["wrong mint authority", { mintAuthority: OTHER_WALLET }],
    ["no mint authority", { mintAuthority: null }],
    ["wrong metadata pointer authority", { metadataAuthority: OTHER_WALLET }],
    ["wrong metadata address", { metadataAddress: OTHER_WALLET }],
    ["wrong group", { group: OTHER_WALLET }],
    ["mint owned by the legacy token program", { program: LEGACY_TOKEN_PROGRAM }],
  ] as const) {
    it(`rejects a look-alike token with ${name}`, async () => {
      chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
      chain.mints[REAL_SGT] = mintAccount(REAL_SGT, opts);
      assert.deepEqual(await resolveTier(db, rpc, WALLET), { tier: "unverified", reason: "no_sgt" });
    });
  }

  it("rejects a token account with zero balance", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT, "0")];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    assert.deepEqual(await findSgtMints(rpc, WALLET), []);
  });

  it("rejects a mint that no longer exists", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    assert.deepEqual(await findSgtMints(rpc, WALLET), []);
  });

  it("rejects a mint missing its extensions or parsed data", async () => {
    const bare = mintAccount(REAL_SGT);
    bare.data.parsed.info.extensions = [];
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = bare;
    assert.deepEqual(await findSgtMints(rpc, WALLET), []);
    chain.mints[REAL_SGT] = { ...mintAccount(REAL_SGT), data: ["", "base64"] };
    assert.deepEqual(await findSgtMints(rpc, WALLET), []);
  });

  it("ignores token accounts owned by a different wallet", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(OTHER_WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    assert.deepEqual(await findSgtMints(rpc, WALLET), []);
  });

  it("finds the SGT among many tokens, batching mint lookups by 100", async () => {
    const junk = Array.from({ length: 250 }, (_, i) => {
      const bytes = new Uint8Array(32);
      bytes[0] = 1;
      bytes[1] = i;
      bytes[2] = i >> 8;
      return getAddressDecoder().decode(bytes);
    });
    chain.tokenAccounts[WALLET] = [...junk.map((m) => tokenAccount(WALLET, m)), tokenAccount(WALLET, REAL_SGT)];
    for (const m of junk) chain.mints[m] = mintAccount(m, { mintAuthority: OTHER_WALLET });
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    assert.deepEqual(await findSgtMints(rpc, WALLET), [REAL_SGT]);
    assert.equal(chain.calls.filter((c) => c.method === "getMultipleAccounts").length, 3);
  });

  it("binds a mint to the first wallet and rejects it on another wallet", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    assert.equal((await resolveTier(db, rpc, WALLET)).tier, "verified_seeker");

    chain.tokenAccounts[WALLET] = [];
    chain.tokenAccounts[OTHER_WALLET] = [tokenAccount(OTHER_WALLET, REAL_SGT)];
    assert.deepEqual(await resolveTier(db, rpc, OTHER_WALLET), {
      tier: "unverified",
      reason: "sgt_claimed_by_another_wallet",
    });
    assert.deepEqual(await resolveTier(db, rpc, WALLET), { tier: "unverified", reason: "no_sgt" });
  });

  it("stays verified for the same wallet on repeated checks", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    for (let i = 0; i < 3; i++) assert.equal((await resolveTier(db, rpc, WALLET)).tier, "verified_seeker");
    const rows = await db.query("SELECT * FROM sgt_claims");
    assert.equal(rows.length, 1);
  });

  it("lets exactly one wallet win concurrent claims of the same mint", async () => {
    chain.tokenAccounts[WALLET] = [tokenAccount(WALLET, REAL_SGT)];
    chain.tokenAccounts[OTHER_WALLET] = [tokenAccount(OTHER_WALLET, REAL_SGT)];
    chain.mints[REAL_SGT] = mintAccount(REAL_SGT);
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => resolveTier(db, rpc, i % 2 ? WALLET : OTHER_WALLET)),
    );
    const winners = new Set(
      results.map((r, i) => (r.tier === "verified_seeker" ? (i % 2 ? WALLET : OTHER_WALLET) : null)).filter(Boolean),
    );
    assert.equal(winners.size, 1);
  });

  it("propagates RPC failures instead of reporting unverified", async () => {
    chain.fail = true;
    await assert.rejects(resolveTier(db, rpc, WALLET));
  });
});
