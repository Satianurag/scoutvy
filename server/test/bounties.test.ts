import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { address, createSolanaRpcFromTransport, getAddressEncoder, getI64Encoder, getU64Encoder } from "@solana/kit";

import { confirmBounty, createBounty, parseBountyInput, recoverBounty } from "../lib/bounties.js";
import type { Db } from "../lib/db.js";
import {
  BOUNTY_TOKENS,
  ESCROW_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  bountyAddress,
  getBountyTokens,
  uuidBytes,
  type EscrowRpc,
  type CloseRpc,
} from "../lib/escrow.js";

const ALICE = "9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo";
const BOB = "D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV";
const SIG = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const SIG2 = "4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const [SKR, USDC] = BOUNTY_TOKENS.map((t) => t.mint);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

const validBody = {
  title: "Is the bakery open?",
  instructions: "Take a photo of the front door showing today's opening hours.",
  latitude: 28.6315,
  longitude: 77.2167,
  locationLabel: "Connaught Place, New Delhi",
  radiusM: 100,
  mint: SKR,
  amount: "5000000",
  durationHours: 24,
};

function input(overrides: Record<string, unknown> = {}) {
  const parsed = parseBountyInput({ ...validBody, ...overrides });
  if (!("input" in parsed)) assert.fail(`invalid ${parsed.invalid}`);
  return parsed.input;
}

let db: Db;

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(schema);
  db = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
  };
  await db.query("INSERT INTO users (wallet_address) VALUES ($1), ($2)", [ALICE, BOB]);
});

describe("parseBountyInput", () => {
  it("accepts a complete bounty and trims text", () => {
    const parsed = input({ title: "  Is the bakery open?  " });
    assert.equal(parsed.title, "Is the bakery open?");
    assert.equal(parsed.amount, 5_000_000n);
  });

  const cases: [string, Record<string, unknown>, string][] = [
    ["short title", { title: "abc" }, "title"],
    ["multi-line title", { title: "line one\nline two" }, "title"],
    ["long title", { title: "x".repeat(61) }, "title"],
    ["short instructions", { instructions: "photo" }, "instructions"],
    ["long instructions", { instructions: "x".repeat(501) }, "instructions"],
    ["latitude out of range", { latitude: 91 }, "location"],
    ["non-numeric longitude", { longitude: "77" }, "location"],
    ["NaN latitude", { latitude: Number.NaN }, "location"],
    ["empty label", { locationLabel: "  " }, "location_label"],
    ["unsupported radius", { radiusM: 75 }, "radius"],
    ["mainnet SKR mint", { mint: "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3" }, "mint"],
    ["numeric amount", { amount: 5_000_000 }, "amount"],
    ["fractional amount", { amount: "5.5" }, "amount"],
    ["below 1 token", { amount: "999999" }, "amount"],
    ["above 500 tokens", { amount: "500000001" }, "amount"],
    ["negative amount", { amount: "-5000000" }, "amount"],
    ["unsupported duration", { durationHours: 12 }, "duration"],
  ];
  for (const [name, overrides, field] of cases) {
    it(`rejects ${name}`, () => {
      assert.deepEqual(parseBountyInput({ ...validBody, ...overrides }), { invalid: field });
    });
  }

  it("rejects a non-object body", () => {
    assert.deepEqual(parseBountyInput(null), { invalid: "title" });
  });
});

describe("task modes", () => {
  it("accepts remote written work without inventing a location", async () => {
    const parsed = input({ taskMode: "remote", proofType: "written", latitude: null, longitude: null, radiusM: null, locationLabel: null });
    assert.equal(parsed.latitude, null);
    assert.equal(parsed.longitude, null);
    assert.equal(parsed.radiusM, null);
    const bounty = await createBounty(db, ALICE, parsed);
    assert.equal(bounty.taskMode, "remote");
    assert.equal(bounty.proofType, "written");
    assert.equal(bounty.locationLabel, null);
  });
  it("normalizes stale local draft coordinates out of remote work", () => {
    const parsed = input({ taskMode: "remote", proofType: "written" });
    assert.equal(parsed.latitude, null);
    assert.equal(parsed.longitude, null);
    assert.equal(parsed.locationLabel, null);
  });
  it("retains legacy on-site photo behavior and requires an on-site target", () => {
    assert.equal(input().taskMode, "on_site");
    assert.equal(input().proofType, "photo");
    assert.deepEqual(parseBountyInput({ ...validBody, taskMode: "on_site", latitude: null }), { invalid: "location" });
  });
  it("rejects unsupported or ambiguous task modes and remote photo proof", () => {
    assert.deepEqual(parseBountyInput({ ...validBody, taskMode: "anywhere" }), { invalid: "task_mode" });
    assert.deepEqual(parseBountyInput({ ...validBody, taskMode: "remote", proofType: "photo" }), { invalid: "proof_type" });
  });
});

type Chain = {
  recoverySignatures?: string[];
  createLog?: boolean;
  status?: { confirmationStatus: string; err: unknown } | null;
  txKeys?: string[] | null;
  bountyData?: Uint8Array | null;
  bountyOwner?: string;
  vault?: { owner: string; mint: string; authority: string; amount: string } | null;
};

function bountyBytes(poster: string, mint: string, id: string, amount: bigint, expiresAt: bigint) {
  const a = getAddressEncoder();
  return Uint8Array.from([
    237, 16, 105, 198, 19, 69, 242, 234,
    ...a.encode(address(poster)),
    ...a.encode(address(mint)),
    ...uuidBytes(id),
    ...getU64Encoder().encode(amount),
    ...getI64Encoder().encode(1n),
    ...getI64Encoder().encode(expiresAt),
    255,
  ]);
}

function fakeRpc(chain: Chain): EscrowRpc & CloseRpc {
  return createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: [string, { encoding?: string }] };
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result }) as never;
    if (method === "getSignaturesForAddress") return reply((chain.recoverySignatures ?? []).map((signature) => ({
      signature, slot: 1, err: null, memo: null, blockTime: 1, confirmationStatus: "confirmed",
    })));
    if (method === "getSignatureStatuses") return reply({ context: { slot: 1 }, value: [chain.status ?? null] });
    if (method === "getTransaction") {
      return reply(
        chain.txKeys
          ? {
              slot: 1,
              blockTime: 1,
              meta: { err: null, fee: 5000, preBalances: [], postBalances: [], logMessages: chain.createLog ? ["Program log: Instruction: CreateBounty"] : [] },
              transaction: {
                signatures: [SIG],
                message: { accountKeys: chain.txKeys, header: {}, instructions: [], recentBlockhash: "11111111111111111111111111111111" },
              },
            }
          : null,
      );
    }
    if (method === "getAccountInfo" && params[1].encoding === "base64") {
      return reply({
        context: { slot: 1 },
        value: chain.bountyData
          ? {
              data: [Buffer.from(chain.bountyData).toString("base64"), "base64"],
              executable: false,
              lamports: 1,
              owner: chain.bountyOwner ?? ESCROW_PROGRAM_ID,
              rentEpoch: 0,
              space: chain.bountyData.length,
            }
          : null,
      });
    }
    if (method === "getAccountInfo") {
      const v = chain.vault;
      return reply({
        context: { slot: 1 },
        value: v
          ? {
              data: { program: "spl-token", space: 165, parsed: { type: "account", info: { mint: v.mint, owner: v.authority, tokenAmount: { amount: v.amount, decimals: 6 } } } },
              executable: false,
              lamports: 1,
              owner: v.owner,
              rentEpoch: 0,
              space: 165,
            }
          : null,
      });
    }
    throw new Error(`unexpected ${method}`);
  });
}

async function fundedChain(bounty: { id: string; mint: string; amount: string; expiresAt: string }, poster = ALICE): Promise<Chain> {
  const pda = await bountyAddress(address(poster), bounty.id);
  const expiresAt = BigInt(new Date(bounty.expiresAt).getTime() / 1000);
  return {
    status: { confirmationStatus: "confirmed", err: null },
    txKeys: [poster, pda, ESCROW_PROGRAM_ID],
    bountyData: bountyBytes(poster, bounty.mint, bounty.id, BigInt(bounty.amount), expiresAt),
    vault: { owner: TOKEN_PROGRAM_ID, mint: bounty.mint, authority: pda, amount: bounty.amount },
  };
}

describe("createBounty", () => {
  it("stores a pending bounty with a whole-second expiry and its PDA", async () => {
    const now = new Date("2026-10-01T10:00:00.500Z");
    const bounty = await createBounty(db, ALICE, input(), now);
    assert.equal(bounty.status, "pending");
    assert.equal(bounty.expiresAt, "2026-10-02T10:00:00.000Z");
    assert.equal(bounty.bountyAddress, await bountyAddress(address(ALICE), bounty.id));
    assert.equal(bounty.signature, null);
    assert.equal(bounty.amount, "5000000");
    assert.equal(bounty.programId, ESCROW_PROGRAM_ID);
  });
});

describe("confirmBounty", () => {
  it("opens a bounty once the escrow is funded on-chain, idempotently", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const rpc = fakeRpc(await fundedChain(bounty));
    const first = await confirmBounty(db, rpc, ALICE, bounty.id, SIG);
    assert.equal(first.status, "open");
    assert.ok(first.status === "open" && first.bounty.signature === SIG);
    assert.equal((await confirmBounty(db, rpc, ALICE, bounty.id, SIG)).status, "open");
    assert.equal((await confirmBounty(db, rpc, ALICE, bounty.id, SIG2)).status, "conflict");
  });

  it("refuses another wallet's bounty", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const rpc = fakeRpc(await fundedChain(bounty));
    assert.equal((await confirmBounty(db, rpc, BOB, bounty.id, SIG)).status, "not_found");
  });

  it("rejects malformed ids and signatures", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const rpc = fakeRpc(await fundedChain(bounty));
    assert.equal((await confirmBounty(db, rpc, ALICE, "nope", SIG)).status, "not_found");
    assert.equal((await confirmBounty(db, rpc, ALICE, bounty.id, "not-a-signature")).status, "invalid_signature");
  });

  it("refuses to reuse one transaction for two bounties", async () => {
    const a = await createBounty(db, ALICE, input());
    const b = await createBounty(db, ALICE, input());
    assert.equal((await confirmBounty(db, fakeRpc(await fundedChain(a)), ALICE, a.id, SIG)).status, "open");
    // Even if the chain looked funded for b, the signature is already bound to a.
    assert.equal((await confirmBounty(db, fakeRpc(await fundedChain(b)), ALICE, b.id, SIG)).status, "conflict");
  });

  const failures: [string, (c: Chain, b: { id: string; mint: string }) => Promise<void> | void, string][] = [
    ["unknown signature", (c) => void (c.status = null), "unconfirmed"],
    ["processed-only signature", (c) => void (c.status = { confirmationStatus: "processed", err: null }), "unconfirmed"],
    ["failed transaction", (c) => void (c.status = { confirmationStatus: "confirmed", err: { InstructionError: [0, "Custom"] } }), "failed"],
    ["transaction that never touched the bounty", (c) => void (c.txKeys = [ALICE, ESCROW_PROGRAM_ID]), "mismatch"],
    ["missing bounty account", (c) => void (c.bountyData = null), "not_found"],
    ["bounty account owned by another program", (c) => void (c.bountyOwner = TOKEN_PROGRAM_ID), "mismatch"],
    ["smaller on-chain amount", (c, b) => void (c.bountyData = bountyBytes(ALICE, b.mint, b.id, 1n, 0n)), "mismatch"],
    ["different on-chain mint", (c, b) => void (c.bountyData = bountyBytes(ALICE, USDC, b.id, 5_000_000n, 0n)), "mismatch"],
    ["truncated bounty data", (c) => void (c.bountyData = c.bountyData!.subarray(0, 100)), "mismatch"],
    ["empty vault", (c) => void (c.vault!.amount = "0"), "mismatch"],
    ["vault owned by someone else", (c) => void (c.vault!.authority = BOB), "mismatch"],
    ["missing vault", (c) => void (c.vault = null), "mismatch"],
  ];
  for (const [name, mutate, expected] of failures) {
    it(`keeps the bounty pending on ${name}`, async () => {
      const bounty = await createBounty(db, ALICE, input());
      const chain = await fundedChain(bounty);
      await mutate(chain, bounty);
      assert.equal((await confirmBounty(db, fakeRpc(chain), ALICE, bounty.id, SIG)).status, expected);
      const [row] = await db.query<{ status: string; create_signature: string | null }>(
        "SELECT status, create_signature FROM bounties WHERE id = $1",
        [bounty.id],
      );
      assert.deepEqual(row, { status: "pending", create_signature: null });
    });
  }

  it("derives the vault as the bounty PDA's associated token account", async () => {
    const pda = await bountyAddress(address(ALICE), "00000000-0000-4000-8000-000000000000");
    assert.notEqual(await associatedTokenAddress(pda, SKR), pda);
  });
});

describe("getBountyTokens", () => {
  it("returns a devnet balance for every bounty token", async () => {
    const rpc = createSolanaRpcFromTransport(async ({ payload }) => {
      const { id, params } = payload as { id: number; params: [string, { mint: string }] };
      const mint = params[1].mint;
      const value =
        mint === SKR
          ? [
              {
                pubkey: BOB,
                account: {
                  executable: false,
                  lamports: 1,
                  owner: TOKEN_PROGRAM_ID,
                  rentEpoch: 0,
                  space: 165,
                  data: { program: "spl-token", space: 165, parsed: { type: "account", info: { mint, owner: ALICE, tokenAmount: { amount: "42000000", decimals: 6 } } } },
                },
              },
            ]
          : [];
      return { jsonrpc: "2.0", id, result: { context: { slot: 1 }, value } } as never;
    });
    const tokens = await getBountyTokens(rpc, address(ALICE));
    assert.deepEqual(
      tokens.map((t) => [t.symbol, t.amount]),
      [
        ["SKR", "42000000"],
        ["USDC", "0"],
      ],
    );
  });
});


describe("recoverBounty", () => {
  it("recovers a landed payment when the wallet response was lost", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const chain = { ...await fundedChain(bounty), recoverySignatures: [SIG], createLog: true };
    const result = await recoverBounty(db, fakeRpc(chain), ALICE, bounty.id);
    assert.equal(result.status, "recovered");
    assert.ok(result.status === "recovered" && result.bounty.status === "open" && result.bounty.signature === SIG);
    assert.equal((await recoverBounty(db, fakeRpc({}), ALICE, bounty.id)).status, "recovered");
  });
  it("returns an unfunded draft without opening it", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const result = await recoverBounty(db, fakeRpc({}), ALICE, bounty.id);
    assert.ok(result.status === "recovered" && result.bounty.status === "pending" && result.bounty.signature === null);
  });
  it("does not reveal or recover another wallet’s draft", async () => {
    const bounty = await createBounty(db, ALICE, input());
    assert.equal((await recoverBounty(db, fakeRpc({}), BOB, bounty.id)).status, "not_found");
  });
  it("never trusts a funded-looking account with mismatched reward", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const chain = await fundedChain(bounty);
    chain.vault!.amount = "1";
    assert.equal((await recoverBounty(db, fakeRpc(chain), ALICE, bounty.id)).status, "mismatch");
  });
  it("keeps funded escrow pending until its create transaction is verified", async () => {
    const bounty = await createBounty(db, ALICE, input());
    const chain = { ...await fundedChain(bounty), recoverySignatures: [SIG] };
    assert.equal((await recoverBounty(db, fakeRpc(chain), ALICE, bounty.id)).status, "unconfirmed");
    const [row] = await db.query<{status:string}>("SELECT status FROM bounties WHERE id=$1", [bounty.id]);
    assert.equal(row.status, "pending");
  });
});
