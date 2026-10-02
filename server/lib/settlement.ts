import { createHash } from "node:crypto";

import {
  address, appendTransactionMessageInstructions, createKeyPairSignerFromBytes, createTransactionMessage,
  getAddressDecoder, getAddressEncoder, getBase58Encoder, getBase64EncodedWireTransaction, getProgramDerivedAddress,
  getSignatureFromTransaction, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners, type Address, type GetAccountInfoApi, type Instruction, type KeyPairSigner, type Rpc,
} from "@solana/kit";

import { attestInstruction, settlementDiscriminators, settlementInstructions } from "../../src/post/settlement.js";
import { associatedTokenAddress, bountyAddress, ESCROW_PROGRAM_ID, type CloseRpc } from "./escrow.js";
import { ProofError } from "./proofs.js";

const REVIEW_DISCRIMINATOR = [124, 63, 203, 215, 226, 30, 222, 15];
export type ChainReview = {
  bounty: Address; poster: Address; scout: Address; mint: Address; amount: bigint;
  proof: string; dispute: string; resolution: string;
  attestedAt: Date; deadline: Date; decidedAt: Date; status: "pending_review" | "disputed" | "paid" | "refunded";
};
export type ExpectedReview = { bounty: Address; poster: Address; scout: Address; mint: Address; amount: bigint; proof: string };

export const decisionDigest = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
export async function reviewAddress(bounty: Address) {
  return (await getProgramDerivedAddress({ programAddress: ESCROW_PROGRAM_ID, seeds: ["review", getAddressEncoder().encode(bounty)] }))[0];
}
export async function configAddress() {
  return (await getProgramDerivedAddress({ programAddress: ESCROW_PROGRAM_ID, seeds: ["review_config"] }))[0];
}

export async function resolverAddress(rpc: Rpc<GetAccountInfoApi>): Promise<Address> {
  const { value } = await rpc.getAccountInfo(await configAddress(), { commitment: "confirmed", encoding: "base64" }).send();
  const data = value ? Buffer.from(value.data[0], "base64") : null;
  if (value?.owner !== ESCROW_PROGRAM_ID || !data || data.length !== 72
    || !data.subarray(0, 8).equals(Buffer.from([255, 168, 36, 168, 235, 238, 101, 88]))) throw new ProofError("review_not_configured", 503);
  return getAddressDecoder().decode(data.subarray(40, 72));
}

export function decodeReview(data: Buffer): ChainReview {
  if (data.length !== 266 || !data.subarray(0, 8).equals(Buffer.from(REVIEW_DISCRIMINATOR))) throw new ProofError("chain_mismatch");
  const statuses = ["pending_review", "disputed", "paid", "refunded"] as const;
  const status = statuses[data[264]];
  if (!status) throw new ProofError("chain_mismatch");
  const a = getAddressDecoder();
  const date = (offset: number) => new Date(Number(data.readBigInt64LE(offset)) * 1000);
  return {
    bounty: a.decode(data.subarray(8, 40)), poster: a.decode(data.subarray(40, 72)), scout: a.decode(data.subarray(72, 104)),
    mint: a.decode(data.subarray(104, 136)), amount: data.readBigUInt64LE(136),
    proof: data.subarray(144, 176).toString("hex"), dispute: data.subarray(176, 208).toString("hex"),
    resolution: data.subarray(208, 240).toString("hex"),
    attestedAt: date(240), deadline: date(248), decidedAt: date(256), status,
  };
}

export async function readReview(rpc: Rpc<GetAccountInfoApi>, expected: ExpectedReview): Promise<ChainReview | null> {
  const { value } = await rpc.getAccountInfo(await reviewAddress(expected.bounty), { commitment: "confirmed", encoding: "base64" }).send();
  if (!value) return null;
  if (value.owner !== ESCROW_PROGRAM_ID) throw new ProofError("chain_mismatch");
  const row = decodeReview(Buffer.from(value.data[0], "base64"));
  if (row.bounty !== expected.bounty || row.poster !== expected.poster || row.scout !== expected.scout
    || row.mint !== expected.mint || row.amount !== expected.amount || row.proof !== expected.proof) throw new ProofError("chain_mismatch");
  if (row.status === "paid" || row.status === "refunded") {
    const [bounty, vault] = await Promise.all([
      rpc.getAccountInfo(expected.bounty, { commitment: "confirmed", encoding: "base64" }).send(),
      rpc.getAccountInfo(await associatedTokenAddress(expected.bounty, expected.mint), { commitment: "confirmed", encoding: "base64" }).send(),
    ]);
    if (bounty.value || vault.value) throw new ProofError("chain_mismatch");
  }
  return row;
}

export async function reviewSignature(rpc: CloseRpc, expected: ExpectedReview, action: "attest" | "dispute" | "paid" | "refunded") {
  const pda = await reviewAddress(expected.bounty);
  const allowed = action === "paid"
    ? [settlementDiscriminators.approve, settlementDiscriminators.release, settlementDiscriminators.resolve]
    : action === "refunded" ? [settlementDiscriminators.resolve] : [settlementDiscriminators[action]];
  const entries = await rpc.getSignaturesForAddress(pda, { commitment: "confirmed", limit: 20 }).send();
  for (const entry of entries) {
    if (entry.err) continue;
    const tx = await rpc.getTransaction(entry.signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 }).send();
    if (!tx || tx.meta?.err) continue;
    const keys = [...tx.transaction.message.accountKeys, ...(tx.meta?.loadedAddresses?.writable ?? []), ...(tx.meta?.loadedAddresses?.readonly ?? [])];
    if (tx.transaction.message.instructions.some((ix) => {
      if (keys[ix.programIdIndex] !== ESCROW_PROGRAM_ID || !ix.accounts.map((i) => keys[i]).includes(pda)) return false;
      const data = getBase58Encoder().encode(ix.data);
      return allowed.some((prefix) => prefix.every((b, i) => b === data[i]));
    })) return entry.signature;
  }
  throw new ProofError("unconfirmed", 503);
}

export type SubmitInstructions = (instructions: Instruction[]) => Promise<string>;
export async function attesterSigner(): Promise<KeyPairSigner> {
  const raw = process.env.SCOUTVY_ATTESTER_KEYPAIR_JSON;
  if (!raw) throw new ProofError("review_not_configured", 503);
  const bytes: unknown = JSON.parse(raw);
  if (!Array.isArray(bytes) || bytes.length !== 64 || !bytes.every((v: unknown) => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 255)) {
    throw new ProofError("review_not_configured", 503);
  }
  return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
}

export async function sendInstructions(rpc: ReturnType<typeof import("@solana/kit").createSolanaRpc>, signer: KeyPairSigner, instructions: Instruction[]) {
  const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const tx = await signTransactionMessageWithSigners(pipe(
    createTransactionMessage({ version: 0 }), (m) => setTransactionMessageFeePayerSigner(signer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m), (m) => appendTransactionMessageInstructions(instructions, m),
  ));
  const wire = getBase64EncodedWireTransaction(tx);
  const { value: simulation } = await rpc.simulateTransaction(wire, { encoding: "base64", sigVerify: true }).send();
  if (simulation.err) throw new ProofError("simulation_failed");
  await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
  const signature = getSignatureFromTransaction(tx);
  for (let attempt = 0; attempt < 10; attempt++) {
    const { value } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (value[0]?.err) throw new ProofError("transaction_failed");
    if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") return signature;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new ProofError("unconfirmed", 503);
}

export async function attest(rpc: ReturnType<typeof import("@solana/kit").createSolanaRpc>, expected: ExpectedReview) {
  const existing = await readReview(rpc, expected);
  if (existing) return;
  const signer = await attesterSigner();
  try {
    await sendInstructions(rpc, signer, [await attestInstruction(signer.address, expected.bounty, expected.scout, expected.proof)]);
  } catch (error) {
    if (!await readReview(rpc, expected)) throw error;
  }
}

export async function releaseUnreviewed(rpc: ReturnType<typeof import("@solana/kit").createSolanaRpc>, expected: ExpectedReview) {
  const current = await readReview(rpc, expected);
  if (!current || current.status !== "pending_review" || current.deadline.getTime() > Date.now()) throw new ProofError("review_pending");
  const signer = await attesterSigner();
  await sendInstructions(rpc, signer, await settlementInstructions(signer.address, {
    bounty: expected.bounty, poster: expected.poster, mint: expected.mint, recipient: expected.scout,
  }, "release"));
}

export async function expectedBounty(poster: string, id: string) {
  return bountyAddress(address(poster), id);
}
