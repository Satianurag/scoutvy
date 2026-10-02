import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { address, createSolanaRpcFromTransport } from "@solana/kit";

import { closeBounty, createBounty, distanceM, getBounty, listNearby, parseBountyInput, parsePoint } from "../lib/bounties.js";
import type { Db } from "../lib/db.js";
import { BOUNTY_TOKENS, ESCROW_PROGRAM_ID, bountyAddress, type CloseRpc } from "../lib/escrow.js";

const ALICE = "9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo";
const BOB = "D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV";
const SIG = "5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const SIG2 = "4VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW";
const [SKR] = BOUNTY_TOKENS.map((t) => t.mint);
const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");
const CP = { latitude: 28.6315, longitude: 77.2167 };

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

async function post(poster: string, overrides: Record<string, unknown> = {}, status = "open") {
  const parsed = parseBountyInput({
    title: "Is the bakery open?",
    instructions: "Take a photo of the front door showing today's opening hours.",
    ...CP,
    locationLabel: "Connaught Place, New Delhi",
    radiusM: 100,
    mint: SKR,
    amount: "5000000",
    durationHours: 24,
    ...overrides,
  });
  if (!("input" in parsed)) assert.fail(parsed.invalid);
  const bounty = await createBounty(db, poster, parsed.input);
  await db.query("UPDATE bounties SET status = $2 WHERE id = $1", [bounty.id, status]);
  return bounty;
}

describe("distance helpers", () => {
  it("measures great-circle distance", () => {
    const d = distanceM(CP, { latitude: 28.6415, longitude: 77.2167 });
    assert.ok(Math.abs(d - 1112) < 5, String(d));
  });

  it("parses only valid coordinates", () => {
    assert.deepEqual(parsePoint("28.6", "77.2"), { latitude: 28.6, longitude: 77.2 });
    assert.equal(parsePoint(null, "77"), null);
    assert.equal(parsePoint("", "77"), null);
    assert.equal(parsePoint("91", "0"), null);
    assert.equal(parsePoint("abc", "0"), null);
  });
});

describe("listNearby", () => {
  it("returns open, unexpired bounties within range, nearest first, with rounded distance", async () => {
    const far = await post(BOB, { latitude: 28.7315 });
    const near = await post(BOB, { latitude: 28.6335 });
    await post(BOB, { latitude: 29.5 });
    await post(BOB, {}, "pending");
    await post(BOB, {}, "cancelled");
    const expired = await post(BOB);
    await db.query("UPDATE bounties SET expires_at = now() - interval '1 minute' WHERE id = $1", [expired.id]);

    const list = await listNearby(db, ALICE, CP);
    assert.deepEqual(list.map((b) => b.id), [near.id, far.id]);
    assert.equal(list[0].distanceM, 200);
    assert.equal(list[0].mine, false);
    assert.equal(list[0].symbol, "SKR");
    assert.equal(list[0].decimals, 6);
    assert.ok(!("latitude" in list[0]) && !("posterWallet" in list[0]));
    assert.equal(list[0].bountyAddress, null);
    assert.equal(list[0].signature, null);
  });

  it("never reports a distance under 100 m and flags the viewer's own bounties", async () => {
    await post(ALICE);
    const [own] = await listNearby(db, ALICE, CP);
    assert.equal(own.distanceM, 100);
    assert.equal(own.mine, true);
    assert.ok(own.bountyAddress);
  });

  it("finds bounties across the antimeridian", async () => {
    const east = await post(BOB, { latitude: 0, longitude: 179.99 });
    const list = await listNearby(db, ALICE, { latitude: 0, longitude: -179.99 });
    assert.deepEqual(list.map((b) => b.id), [east.id]);
  });
});

describe("getBounty", () => {
  it("shows open bounties to anyone but closed ones only to their poster", async () => {
    const open = await post(BOB);
    const closed = await post(BOB, {}, "cancelled");
    const draft = await post(BOB, {}, "pending");
    assert.equal((await getBounty(db, ALICE, open.id, CP))?.distanceM, 100);
    assert.equal(await getBounty(db, ALICE, closed.id, null), null);
    assert.equal((await getBounty(db, BOB, closed.id, null))?.status, "cancelled");
    assert.equal(await getBounty(db, BOB, draft.id, null), null);
    assert.equal(await getBounty(db, ALICE, "nope", null), null);
  });
});

type CloseChain = {
  accountExists?: boolean;
  signatures?: { signature: string; err: unknown; blockTime: number | null }[];
  txs?: Record<string, { keys: string[]; logs: string[]; err?: unknown; blockTime: number | null } | null>;
};

function closeRpc(chain: CloseChain): CloseRpc {
  return createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: [string] };
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id, result }) as never;
    if (method === "getAccountInfo") {
      return reply({
        context: { slot: 1 },
        value: chain.accountExists
          ? { data: ["", "base64"], executable: false, lamports: 1, owner: ESCROW_PROGRAM_ID, rentEpoch: 0, space: 0 }
          : null,
      });
    }
    if (method === "getSignaturesForAddress") {
      return reply(
        (chain.signatures ?? []).map((s) => ({ ...s, slot: 1, memo: null, confirmationStatus: "confirmed" })),
      );
    }
    if (method === "getTransaction") {
      const tx = chain.txs?.[params[0]];
      return reply(
        tx
          ? {
              slot: 1,
              blockTime: tx.blockTime,
              meta: { err: tx.err ?? null, fee: 5000, preBalances: [], postBalances: [], logMessages: tx.logs },
              transaction: {
                signatures: [params[0]],
                message: { accountKeys: tx.keys, header: {}, instructions: [], recentBlockhash: "11111111111111111111111111111111" },
              },
            }
          : null,
      );
    }
    throw new Error(`unexpected ${method}`);
  });
}

async function closedChain(bounty: { id: string }, blockTime: number, log = "Program log: Instruction: CancelBounty"): Promise<CloseChain> {
  const pda = await bountyAddress(address(ALICE), bounty.id);
  return {
    signatures: [{ signature: SIG, err: null, blockTime }],
    txs: { [SIG]: { keys: [ALICE, pda, ESCROW_PROGRAM_ID], logs: [log], blockTime } },
  };
}

describe("closeBounty", () => {
  it("marks a bounty cancelled when closed before expiry, idempotently", async () => {
    const bounty = await post(ALICE);
    const before = Math.floor(Date.parse(bounty.expiresAt) / 1000) - 60;
    const rpc = closeRpc(await closedChain(bounty, before));
    const result = await closeBounty(db, rpc, ALICE, bounty.id);
    assert.equal(result.status, "closed");
    assert.ok(result.status === "closed" && result.bounty.status === "cancelled" && result.bounty.closeSignature === SIG);
    const again = await closeBounty(db, closeRpc({ accountExists: true }), ALICE, bounty.id);
    assert.ok(again.status === "closed" && again.bounty.status === "cancelled");
  });

  it("marks a bounty expired when refunded after expiry", async () => {
    const bounty = await post(ALICE);
    const after = Math.floor(Date.parse(bounty.expiresAt) / 1000) + 60;
    const result = await closeBounty(db, closeRpc(await closedChain(bounty, after, "Program log: Instruction: RefundExpired")), ALICE, bounty.id);
    assert.ok(result.status === "closed" && result.bounty.status === "expired");
  });

  it("keeps the bounty open while the escrow account still exists", async () => {
    const bounty = await post(ALICE);
    assert.equal((await closeBounty(db, closeRpc({ accountExists: true }), ALICE, bounty.id)).status, "still_open");
  });

  it("ignores transactions that aren't a successful escrow close", async () => {
    const bounty = await post(ALICE);
    const pda = await bountyAddress(address(ALICE), bounty.id);
    const chain: CloseChain = {
      signatures: [
        { signature: SIG, err: { InstructionError: [0, "Custom"] }, blockTime: 1 },
        { signature: SIG2, err: null, blockTime: 1 },
      ],
      txs: { [SIG2]: { keys: [ALICE, pda, ESCROW_PROGRAM_ID], logs: ["Program log: Instruction: CreateBounty"], blockTime: 1 } },
    };
    assert.equal((await closeBounty(db, closeRpc(chain), ALICE, bounty.id)).status, "unconfirmed");
    const [row] = await db.query<{ status: string }>("SELECT status FROM bounties WHERE id = $1", [bounty.id]);
    assert.equal(row.status, "open");
  });

  it("refuses other posters, drafts and malformed ids", async () => {
    const bounty = await post(ALICE);
    const draft = await post(ALICE, {}, "pending");
    const rpc = closeRpc(await closedChain(bounty, 1));
    assert.equal((await closeBounty(db, rpc, BOB, bounty.id)).status, "not_found");
    assert.equal((await closeBounty(db, rpc, ALICE, draft.id)).status, "not_open");
    assert.equal((await closeBounty(db, rpc, ALICE, 42)).status, "not_found");
  });
});
