import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { address, createSolanaRpcFromTransport, getAddressEncoder, getBase58Decoder } from "@solana/kit";

import { settlementDiscriminators } from "../lib/settlement-instructions.js";
import { activity } from "../lib/activity.js";
import { createBounty, parseBountyInput } from "../lib/bounties.js";
import type { Db } from "../lib/db.js";
import { BOUNTY_TOKENS, ESCROW_PROGRAM_ID } from "../lib/escrow.js";
import { ProofError } from "../lib/proofs.js";
import { expectedReview, getReview, prepareDecision, protectedImage, recordDecision, refreshSettlement, reviewRow, reviewView } from "../lib/reviews.js";
import { configAddress, decisionDigest, reviewAddress } from "../lib/settlement.js";

const POSTER = "9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo";
const SCOUT = "D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV";
const RESOLVER = "11111111111111111111111111111111";
const OTHER = BOUNTY_TOKENS[1].mint;
const pg = new PGlite();
const db: Db = { async query<T>(text: string, params: unknown[] = []) { return (await pg.query<T>(text, params)).rows; } };
before(async () => pg.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8")));
after(() => pg.close());
beforeEach(async () => {
  await pg.exec("TRUNCATE users CASCADE");
  await db.query("INSERT INTO users (wallet_address) VALUES ($1), ($2), ($3)", [POSTER, SCOUT, RESOLVER]);
});
const rejects = (work: Promise<unknown>, code: string) => assert.rejects(work, (e: unknown) => e instanceof ProofError && e.code === code);

async function fixture() {
  const input = parseBountyInput({ title: "Read the opening hours", instructions: "Photograph the public sign clearly.",
    latitude: 28.6315, longitude: 77.2167, locationLabel: "Public shop", radiusM: 100,
    mint: BOUNTY_TOKENS[0].mint, amount: "1000000", durationHours: 24 });
  assert.ok("input" in input);
  const bounty = await createBounty(db, POSTER, input.input);
  await db.query("UPDATE bounties SET status = 'open', opened_at = now() WHERE id = $1", [bounty.id]);
  await db.query("INSERT INTO scout_claims (bounty_id, scout_wallet, expires_at, confirmed_at) VALUES ($1, $2, now() + interval '1 hour', now())", [bounty.id, SCOUT]);
  await db.query(`INSERT INTO bounty_proofs (id, bounty_id, scout_wallet, image, source_sha256, image_sha256,
    width, height, reported_latitude, reported_longitude, reported_accuracy_m,
    reported_location_at, reported_capture_at, capture_started_at)
    VALUES ($1, $2, $3, $4, $5, $5, 100, 100, 28.6315, 77.2167, 5, now(), now(), now())`,
    [crypto.randomUUID(), bounty.id, SCOUT, Uint8Array.of(1, 2, 3), decisionDigest("photo")]);
  const expected = await expectedReview(await reviewRow(db, POSTER, bounty.id));
  const pda = await reviewAddress(expected.bounty);
  const config = await configAddress();
  const a = getAddressEncoder();
  const data = Buffer.alloc(266);
  createHash("sha256").update("account:Review").digest().copy(data, 0, 0, 8);
  for (const [offset, value] of [[8, expected.bounty], [40, expected.poster], [72, expected.scout], [104, expected.mint]] as const) {
    data.set(a.encode(value), offset);
  }
  data.writeBigUInt64LE(expected.amount, 136);
  data.set(Buffer.from(expected.proof, "hex"), 144);
  const now = BigInt(Math.floor(Date.now() / 1000));
  data.writeBigInt64LE(now, 240);
  data.writeBigInt64LE(now + 172800n, 248);
  const configData = Buffer.concat([createHash("sha256").update("account:ReviewConfig").digest().subarray(0, 8),
    Buffer.from(a.encode(address(RESOLVER))), Buffer.from(a.encode(address(RESOLVER)))]);
  const state = { present: true, owner: ESCROW_PROGRAM_ID as string, confirmed: true, vaultClosed: true, cancelled: false, history: [] as string[] };
  const rpc = createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: [string, { commitment: string; before?: string }] };
    if (method === "getAccountInfo") {
      assert.equal(params[1].commitment, "confirmed");
      const bytes = params[0] === config ? configData : params[0] === pda && state.present ? data : null;
      const value = bytes ? { data: [bytes.toString("base64"), "base64"], owner: state.owner, executable: false,
        lamports: 1, rentEpoch: 0, space: bytes.length } : state.vaultClosed ? null : { owner: ESCROW_PROGRAM_ID };
      return { jsonrpc: "2.0", id, result: { context: { slot: 1 }, value } } as never;
    }
    if (method === "getSignaturesForAddress") {
      if (state.history.length && !params[1].before) {
        return { jsonrpc: "2.0", id, result: state.history.map((signature) => ({ signature, err: null })) } as never;
      }
      return { jsonrpc: "2.0", id, result: state.confirmed ? [{ signature: "1".repeat(64), err: null }] : [] } as never;
    }
    assert.equal(method, "getTransaction");
    if (state.history.includes(params[0])) return { jsonrpc: "2.0", id, result: null } as never;
    if (state.cancelled) return { jsonrpc: "2.0", id, result: {
      blockTime: Number(now), meta: { err: null, logMessages: ["Program log: Instruction: CancelBounty"] },
      transaction: { message: { accountKeys: [POSTER, expected.bounty, ESCROW_PROGRAM_ID] } },
    } } as never;
    return { jsonrpc: "2.0", id, result: { meta: { err: null }, transaction: { message: {
      accountKeys: [ESCROW_PROGRAM_ID, pda],
      instructions: ["attest", "dispute", "approve", "resolve"].map((action) => ({
        programIdIndex: 0, accounts: [1], data: getBase58Decoder().decode(
          Uint8Array.from(settlementDiscriminators[action as keyof typeof settlementDiscriminators])),
      })),
    } } } } as never;
  });
  return { id: bounty.id, data, rpc, state };
}

it("protects review and image access and excludes location and identities from responses", async () => {
  const f = await fixture();
  for (const [viewer, role] of [[POSTER, "poster"], [SCOUT, "scout"], [RESOLVER, "resolver"]]) {
    const row = await reviewRow(db, viewer, f.id, RESOLVER);
    const view = reviewView(row, viewer, RESOLVER);
    assert.equal(view.role, role);
    for (const privateKey of ["poster_wallet", "scout_wallet", "reported_latitude", "reported_longitude", "latitude", "longitude", "image"]) {
      assert.ok(!(privateKey in view));
    }
    assert.deepEqual(await protectedImage(db, viewer, f.id, RESOLVER), Buffer.from([1, 2, 3]));
  }
  await rejects(reviewRow(db, OTHER, f.id, RESOLVER), "not_found");
  await rejects(protectedImage(db, OTHER, f.id, RESOLVER), "not_found");
  await rejects(prepareDecision(db, f.rpc, SCOUT, f.id, "approve", {}), "forbidden");
  await rejects(prepareDecision(db, f.rpc, POSTER, f.id, "resolve", {}), "forbidden");
});

it("serializes incompatible decisions while same-action preparation is idempotent", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    prepareDecision(db, f.rpc, POSTER, f.id, "approve", {}),
    prepareDecision(db, f.rpc, POSTER, f.id, "dispute", { reason: "The requested sign is missing" }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const won = results.find((r) => r.status === "fulfilled");
  assert.ok(won?.status === "fulfilled");
  const action = won.value.transaction!.action;
  const retried = await prepareDecision(db, f.rpc, POSTER, f.id, action, { reason: "The requested sign is missing" });
  assert.deepEqual(retried.transaction, won.value.transaction);
  const [row] = await db.query<{ attempt_count: number; attempted_at: unknown }>("SELECT attempt_count, attempted_at FROM bounty_proofs");
  assert.equal(row.attempt_count, 0);
  assert.equal(row.attempted_at, null);
  assert.ok((await activity(db, POSTER, undefined, RESOLVER)).events.some((e) => e.kind === "decision_prepared"));
  assert.ok(!(await activity(db, POSTER, undefined, RESOLVER)).events.some((e) => e.kind === "retry" || e.kind === "paid"));
});

it("requires confirmed signatures, matching proof data and closed vault before reporting payment", async () => {
  const f = await fixture();
  f.state.confirmed = false;
  await rejects(getReview(db, f.rpc, POSTER, f.id), "unconfirmed");
  f.state.confirmed = true;
  f.data[144] ^= 1;
  await rejects(getReview(db, f.rpc, POSTER, f.id), "chain_mismatch");
  f.data[144] ^= 1;
  f.data[264] = 2;
  f.data.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), 256);
  f.state.vaultClosed = false;
  await rejects(getReview(db, f.rpc, POSTER, f.id), "chain_mismatch");
  f.state.vaultClosed = true;
  assert.equal((await getReview(db, f.rpc, POSTER, f.id)).status, "paid");
  const duplicate = await prepareDecision(db, f.rpc, POSTER, f.id, "approve", {});
  assert.equal(duplicate.transaction, null);
  f.state.present = false;
  await rejects(refreshSettlement(db, f.rpc, POSTER, f.id), "chain_mismatch");
  const [row] = await db.query<{ status: string; last_error: string | null }>("SELECT status, last_error FROM bounty_proofs");
  assert.equal(row.status, "paid");
  assert.equal(row.last_error, null);
});

it("persists disputes and resolver decisions, with resolver Activity and duplicate protection", async () => {
  const f = await fixture();
  const reason = "The requested sign is missing";
  const decision = await prepareDecision(db, f.rpc, POSTER, f.id, "dispute", { reason });
  f.data.set(Buffer.from(decision.transaction!.digest!, "hex"), 176);
  f.data[264] = 1;
  assert.equal((await getReview(db, f.rpc, RESOLVER, f.id)).status, "disputed");
  assert.equal((await prepareDecision(db, f.rpc, POSTER, f.id, "dispute", { reason })).transaction, null);
  await rejects(prepareDecision(db, f.rpc, POSTER, f.id, "approve", {}), "invalid_state");
  assert.ok((await activity(db, RESOLVER, undefined, RESOLVER)).events.some((e) => e.kind === "disputed"));
  assert.deepEqual((await activity(db, OTHER, undefined, RESOLVER)).events, []);
  const resolution = await prepareDecision(db, f.rpc, RESOLVER, f.id, "resolve", { reason: "Evidence does not fulfill the public sign requirement", payScout: false });
  assert.equal(resolution.transaction!.recipient, POSTER);
  f.data.set(Buffer.from(resolution.transaction!.digest!, "hex"), 208);
  f.data[264] = 3;
  assert.equal((await getReview(db, f.rpc, RESOLVER, f.id)).status, "refunded");
  assert.equal((await prepareDecision(db, f.rpc, RESOLVER, f.id, "resolve", {})).transaction, null);
});

it("persists wallet receipts idempotently without treating them as confirmed payments", async () => {
  const f = await fixture();
  await prepareDecision(db, f.rpc, POSTER, f.id, "approve", {});
  const receipt = { action: "approve", signature: "1".repeat(64) };
  await rejects(recordDecision(db, f.rpc, SCOUT, f.id, receipt), "forbidden");
  await rejects(recordDecision(db, f.rpc, POSTER, f.id, { ...receipt, signature: "invalid" }), "invalid_signature");
  assert.equal((await recordDecision(db, f.rpc, POSTER, f.id, receipt)).status, "pending_review");
  await recordDecision(db, f.rpc, POSTER, f.id, receipt);
  const [row] = await db.query<{ wallet_signature: string; attempt_count: number; settlement_signature: string | null }>("SELECT wallet_signature, attempt_count, settlement_signature FROM bounty_proofs");
  assert.equal(row.wallet_signature, receipt.signature);
  assert.equal(row.attempt_count, 1);
  assert.equal(row.settlement_signature, null);
  f.data[264] = 2;
  assert.equal((await getReview(db, f.rpc, POSTER, f.id)).status, "paid");
});

it("recovers the persisted resolver recipient after an interrupted wallet decision", async () => {
  for (const payScout of [true, false]) {
    const f = await fixture();
    const dispute = await prepareDecision(db, f.rpc, POSTER, f.id, "dispute", { reason: "The requested sign is missing" });
    f.data.set(Buffer.from(dispute.transaction!.digest!, "hex"), 176);
    f.data[264] = 1;
    const reason = "The evidence was reviewed against the instructions";
    const prepared = await prepareDecision(db, f.rpc, RESOLVER, f.id, "resolve", { reason, payScout });
    assert.equal(prepared.transaction!.recipient, payScout ? SCOUT : POSTER);
    const recovered = await getReview(db, f.rpc, RESOLVER, f.id);
    assert.equal(recovered.preparedReason, reason);
    assert.equal(recovered.preparedPayScout, payScout);
    const retried = await prepareDecision(db, f.rpc, RESOLVER, f.id, "resolve", {
      reason: recovered.preparedReason, payScout: recovered.preparedPayScout,
    });
    assert.deepEqual(retried.transaction, prepared.transaction);
  }
});

it("marks failed protection retryable without fabricating protection or settlement", async () => {
  const f = await fixture();
  f.state.present = false;
  const old = process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON;
  delete process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON;
  try { await rejects(refreshSettlement(db, f.rpc, SCOUT, f.id), "review_not_configured"); }
  finally { if (old) process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON = old; }
  const view = reviewView(await reviewRow(db, SCOUT, f.id), SCOUT, RESOLVER);
  assert.equal(view.protected, false);
  assert.equal(view.status, "pending_review");
  assert.equal(view.retryable, true);
  assert.equal(view.signature, null);
});

it("recovers a confirmed settlement beyond the first signature page", async () => {
  const f = await fixture();
  f.state.history = Array.from({ length: 20 }, (_, i) => getBase58Decoder().decode(new Uint8Array(64).fill(i + 1)));
  f.data[264] = 2;
  f.data.writeBigInt64LE(BigInt(Math.floor(Date.now() / 1000)), 256);
  const review = await getReview(db, f.rpc, POSTER, f.id);
  assert.equal(review.status, "paid");
  assert.equal(review.signature, "1".repeat(64));
});

it("reconciles a cancellation that wins before proof protection without allowing payout or endless retries", async () => {
  const f = await fixture();
  f.state.present = false;
  f.state.cancelled = true;
  await db.query("UPDATE bounty_proofs SET last_error = 'service_unavailable' WHERE bounty_id = $1", [f.id]);
  const old = process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON;
  delete process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON;
  try { await rejects(refreshSettlement(db, f.rpc, SCOUT, f.id), "bounty_unavailable"); }
  finally { if (old) process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON = old; }
  const review = await getReview(db, f.rpc, SCOUT, f.id);
  assert.equal(review.status, "cancelled");
  assert.equal(review.protected, false);
  assert.equal(review.retryable, false);
  assert.equal(review.signature, null);
  await rejects(prepareDecision(db, f.rpc, POSTER, f.id, "approve", {}), "bounty_unavailable");
  const [row] = await db.query<{ status: string; close_signature: string }>("SELECT status, close_signature FROM bounties WHERE id = $1", [f.id]);
  assert.equal(row.status, "cancelled");
  assert.equal(row.close_signature, "1".repeat(64));
});

it("paginates equal-time activity without omissions or duplicate events", async () => {
  for (let i = 0; i < 18; i++) await fixture();
  await pg.exec(`UPDATE bounties SET opened_at = '2026-01-01T00:00:00Z';
    UPDATE scout_claims SET accepted_at = '2026-01-01T00:00:00Z';
    UPDATE bounty_proofs SET received_at = '2026-01-01T00:00:00Z', attestation_signature = 'attested',
    review_deadline = '2026-01-03T00:00:00Z', decision_action = 'approve', decision_prepared_at = '2026-01-01T00:00:00Z'`);
  const first = await activity(db, POSTER, undefined, RESOLVER);
  assert.equal(first.events.length, 50);
  assert.ok(first.next);
  const second = await activity(db, POSTER, first.next, RESOLVER);
  assert.equal(second.events.length, 22);
  assert.equal(second.next, null);
  assert.equal(new Set([...first.events, ...second.events].map((e) => e.id)).size, 72);
  await rejects(activity(db, POSTER, "bad cursor", RESOLVER), "invalid_cursor");
});
