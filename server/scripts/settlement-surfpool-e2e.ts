import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  address, appendTransactionMessageInstructions, createSolanaRpc, createTransactionMessage,
  generateKeyPairSigner, getAddressEncoder, getBase64EncodedWireTransaction, pipe,
  setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners, type Address, type Instruction, type KeyPairSigner,
} from "@solana/kit";

import { claimInstruction, createBountyInstruction, cancelBountyInstruction, refundExpiredInstruction } from "../lib/escrow-instructions.js";
import { attestInstruction, disputeInstruction, settlementInstructions } from "../lib/settlement-instructions.js";
import { readClaim } from "../lib/claims.js";
import { associatedTokenAddress, bountyAddress, BOUNTY_TOKENS, ESCROW_PROGRAM_ID, TOKEN_PROGRAM_ID } from "../lib/escrow.js";
import { configAddress, decisionDigest, readReview, reviewAddress, sendInstructions, type ExpectedReview } from "../lib/settlement.js";

const url = process.env.SURFPOOL_RPC_URL ?? "http://127.0.0.1:8899";
assert.ok(new URL(url).hostname === "127.0.0.1" || new URL(url).hostname === "localhost", "Test fixtures require a local chain");
const rpc = createSolanaRpc(url);
async function cheat(method: string, params: unknown[]) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const result = await response.json() as { error?: unknown; result?: unknown };
  assert.equal(result.error, undefined, JSON.stringify(result.error));
  return result.result;
}
async function wallet() {
  const signer = await generateKeyPairSigner();
  await cheat("surfnet_setAccount", [signer.address, { lamports: 10_000_000_000 }]);
  return signer;
}
const poster = await wallet(), scout = await wallet(), authority = await wallet(), other = await wallet();
await cheat("surfnet_writeProgram", [ESCROW_PROGRAM_ID,
  (await readFile(new URL("../../escrow/target/deploy/escrow.so", import.meta.url))).toString("hex"), 0, authority.address]);
const encoder = getAddressEncoder();
const discriminator = (name: string) => createHash("sha256").update(`account:${name}`).digest().subarray(0, 8);
await cheat("surfnet_setAccount", [await configAddress(), { lamports: 10_000_000, owner: ESCROW_PROGRAM_ID,
  data: Buffer.concat([discriminator("ReviewConfig"), Buffer.from(encoder.encode(authority.address)), Buffer.from(encoder.encode(authority.address))]).toString("hex") }]);
for (const token of BOUNTY_TOKENS) {
  const data = Buffer.alloc(82); data[44] = token.decimals; data[45] = 1;
  await cheat("surfnet_setAccount", [token.mint, { lamports: 1_461_600, owner: TOKEN_PROGRAM_ID, data: data.toString("hex") }]);
  await cheat("surfnet_setTokenAccount", [poster.address, token.mint, { amount: 100_000_000, state: "initialized" }]);
}
async function now() {
  const { value } = await rpc.getAccountInfo(address("SysvarC1ock11111111111111111111111111111111"), { encoding: "base64" }).send();
  return Buffer.from(value!.data[0], "base64").readBigInt64LE(32);
}
async function rejected(signer: KeyPairSigner, instructions: Instruction[]) {
  const { value: lifetime } = await rpc.getLatestBlockhash().send();
  const tx = await signTransactionMessageWithSigners(pipe(createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(signer, m), (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(instructions, m)));
  const { value } = await rpc.simulateTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", sigVerify: true }).send();
  assert.ok(value.err, `Expected rejection: ${JSON.stringify(value.logs)}`);
}
async function fixture(mint: Address = BOUNTY_TOKENS[0].mint, accept = true) {
  const b = { id: crypto.randomUUID(), poster: poster.address, mint, amount: 1_000_000n, expiresAt: await now() + 86400n };
  await sendInstructions(rpc, poster, [await createBountyInstruction(b)]);
  const expected: ExpectedReview = { bounty: await bountyAddress(poster.address, b.id), poster: poster.address,
    scout: scout.address, mint, amount: b.amount, proof: decisionDigest(b.id) };
  if (accept) await sendInstructions(rpc, scout, [await claimInstruction(scout.address, expected.bounty, await now() + 3600n)]);
  const protect = async () => sendInstructions(rpc, authority, [await attestInstruction(authority.address, expected.bounty, scout.address, expected.proof)]);
  const settle = (signer: KeyPairSigner, action: "approve" | "release" | "resolve", recipient = scout.address, payScout = true) =>
    settlementInstructions(signer.address, { ...expected, recipient }, action, { payScout, digest: decisionDigest("Resolution based on the submitted evidence") });
  return { b, expected, protect, settle };
}
const longTask = await fixture(BOUNTY_TOKENS[0].mint, false);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, longTask.expected.bounty, longTask.b.expiresAt)]);
assert.equal((await readClaim(rpc, longTask.expected.bounty))?.expiresAt.getTime(), Number(longTask.b.expiresAt) * 1000);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, longTask.expected.bounty)]);
await sendInstructions(rpc, poster, [await cancelBountyInstruction(longTask.b)]);
console.log("PASS full-deadline claim: accepts a day-long assignment, releases, and returns escrow");

const claimed = await fixture(BOUNTY_TOKENS[0].mint, false);
await rejected(authority, [await attestInstruction(authority.address, claimed.expected.bounty, scout.address, claimed.expected.proof)]);
await rejected(poster, [await claimInstruction(poster.address, claimed.expected.bounty, await now() + 3600n)]);
await rejected(scout, [await claimInstruction(scout.address, claimed.expected.bounty, claimed.b.expiresAt + 1n)]);
await rejected(scout, [await claimInstruction(scout.address, claimed.expected.bounty, await now())]);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, claimed.expected.bounty, await now() + 3600n)]);
const firstClaim = await readClaim(rpc, claimed.expected.bounty);
assert.ok(firstClaim);
assert.equal(firstClaim.scout, scout.address);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, claimed.expected.bounty, await now() + 1800n)]);
assert.deepEqual(await readClaim(rpc, claimed.expected.bounty), firstClaim);
await rejected(other, [await claimInstruction(other.address, claimed.expected.bounty, await now() + 3600n)]);
await rejected(other, [await claimInstruction(other.address, claimed.expected.bounty)]);
await rejected(authority, [await attestInstruction(authority.address, claimed.expected.bounty, other.address, claimed.expected.proof)]);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, claimed.expected.bounty)]);
assert.equal((await readClaim(rpc, claimed.expected.bounty))?.expiresAt.getTime(), 0);
await rejected(authority, [await attestInstruction(authority.address, claimed.expected.bounty, scout.address, claimed.expected.proof)]);
await sendInstructions(rpc, other, [await claimInstruction(other.address, claimed.expected.bounty, await now() + 3600n)]);
await rejected(authority, [await attestInstruction(authority.address, claimed.expected.bounty, scout.address, claimed.expected.proof)]);
await cheat("surfnet_timeTravel", [{ absoluteTimestamp: (await readClaim(rpc, claimed.expected.bounty))!.expiresAt.getTime() + 1000 }]);
await rejected(authority, [await attestInstruction(authority.address, claimed.expected.bounty, other.address, claimed.expected.proof)]);
await sendInstructions(rpc, scout, [await claimInstruction(scout.address, claimed.expected.bounty, await now() + 3600n)]);
await claimed.protect();
await rejected(scout, [await claimInstruction(scout.address, claimed.expected.bounty)]);
await rejected(other, [await claimInstruction(other.address, claimed.expected.bounty, await now() + 3600n)]);
console.log("PASS signed claim: missing claim, recipient binding, replay, ownership, expiry, release, takeover, protected lock");
for (const token of BOUNTY_TOKENS) {
  const f = await fixture(token.mint);
  await rejected(other, [await attestInstruction(other.address, f.expected.bounty, scout.address, f.expected.proof)]);
  await rejected(authority, [await attestInstruction(authority.address, f.expected.bounty, poster.address, f.expected.proof)]);
  await rejected(authority, [await attestInstruction(authority.address, f.expected.bounty, other.address, f.expected.proof)]);
  await rejected(authority, [await attestInstruction(authority.address, f.expected.bounty, scout.address, "0".repeat(64))]);
  await f.protect();
  await rejected(authority, [await attestInstruction(authority.address, f.expected.bounty, scout.address, f.expected.proof)]);
  await rejected(poster, [await cancelBountyInstruction(f.b)]);
  await rejected(scout, await f.settle(scout, "approve"));
  await rejected(poster, await f.settle(poster, "approve", other.address));
  const { value: before } = await rpc.getTokenAccountBalance(await associatedTokenAddress(poster.address, token.mint)).send();
  await sendInstructions(rpc, poster, await f.settle(poster, "approve"));
  assert.equal((await readReview(rpc, f.expected))?.status, "paid");
  const { value: balance } = await rpc.getTokenAccountBalance(await associatedTokenAddress(scout.address, token.mint)).send();
  assert.equal(balance.amount, "1000000");
  assert.equal((await rpc.getTokenAccountBalance(await associatedTokenAddress(poster.address, token.mint)).send()).value.amount, before.amount);
  await rejected(poster, await f.settle(poster, "approve"));
  await rejected(poster, [await cancelBountyInstruction(f.b)]);
  await rejected(poster, [await createBountyInstruction({ ...f.b, expiresAt: await now() + 86400n })]);
  console.log(`PASS ${token.symbol}: bound payout, replay, refund protection, authority, digest, vault closure`);
}
for (const payScout of [true, false]) {
  const f = await fixture(); await f.protect();
  const reason = decisionDigest("The photo does not show the requested opening hours");
  await rejected(scout, [await disputeInstruction(scout.address, f.expected.bounty, reason)]);
  await sendInstructions(rpc, poster, [await disputeInstruction(poster.address, f.expected.bounty, reason)]);
  await rejected(poster, [await disputeInstruction(poster.address, f.expected.bounty, reason)]);
  await rejected(poster, await f.settle(poster, "approve"));
  const recipient = payScout ? scout.address : poster.address;
  await rejected(other, await f.settle(other, "resolve", recipient, payScout));
  await rejected(authority, await f.settle(authority, "resolve", other.address, payScout));
  const balance = (await rpc.getTokenAccountBalance(await associatedTokenAddress(recipient, f.expected.mint)).send()).value.amount;
  await sendInstructions(rpc, authority, await f.settle(authority, "resolve", recipient, payScout));
  assert.equal((await readReview(rpc, f.expected))?.status, payScout ? "paid" : "refunded");
  assert.equal(BigInt((await rpc.getTokenAccountBalance(await associatedTokenAddress(recipient, f.expected.mint)).send()).value.amount), BigInt(balance) + f.expected.amount);
  await rejected(authority, await f.settle(authority, "resolve", recipient, payScout));
  console.log(`PASS dispute: resolver ${payScout ? "payout" : "refund"}, authorization, recipient, replay`);
}
const f = await fixture(); await f.protect();
await rejected(other, await f.settle(other, "release"));
const review = await readReview(rpc, f.expected); assert.ok(review);
await cheat("surfnet_timeTravel", [{ absoluteTimestamp: review.deadline.getTime() + 1000 }]);
await rejected(poster, [await disputeInstruction(poster.address, f.expected.bounty, decisionDigest("Late dispute"))]);
await rejected(other, [await refundExpiredInstruction(other.address, f.b)]);
await sendInstructions(rpc, other, await f.settle(other, "release"));
assert.equal((await readReview(rpc, f.expected))?.status, "paid");
const cancelled = await fixture();
await sendInstructions(rpc, poster, [await cancelBountyInstruction(cancelled.b)]);
await rejected(authority, [await attestInstruction(authority.address, cancelled.expected.bounty, scout.address, cancelled.expected.proof)]);
console.log("PASS deadline release, late dispute, protected expiry refund, proof after cancellation");
const mismatch = await fixture(); await mismatch.protect();
const pda = await reviewAddress(mismatch.expected.bounty);
const { value } = await rpc.getAccountInfo(pda, { encoding: "base64" }).send(); assert.ok(value);
for (const offset of [136, 104]) {
  const data = Buffer.from(value.data[0], "base64"); data[offset] ^= 1;
  await cheat("surfnet_setAccount", [pda, { data: data.toString("hex") }]);
  await rejected(poster, await mismatch.settle(poster, "approve"));
}
await cheat("surfnet_setAccount", [pda, { data: Buffer.from(value.data[0], "base64").toString("hex") }]);
await sendInstructions(rpc, poster, await mismatch.settle(poster, "approve"));
console.log("PASS amount/mint tampering rejected, restored legitimate settlement");
