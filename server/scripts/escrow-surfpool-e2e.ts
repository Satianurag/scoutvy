import assert from "node:assert/strict";

import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
} from "@solana/kit";

import {
  associatedTokenAddress,
  bountyAddress,
  cancelBountyInstruction,
  createBountyInstruction,
  refundExpiredInstruction,
  type EscrowBounty,
} from "../lib/escrow-instructions.js";
import { BOUNTY_TOKENS, TOKEN_PROGRAM_ID, checkEscrow } from "../lib/escrow.js";

// Run against `surfpool start --offline` with target/deploy/escrow.so deployed at the program id and
// the devnet test SKR mint created locally (see escrow/README.md).
const SURF = process.env.SURFPOOL_RPC_URL ?? "http://127.0.0.1:8899";
const rpc = createSolanaRpc(SURF);
const SKR = BOUNTY_TOKENS[0].mint;
const HOUR = 3600n;

async function cheat(method: string, params: unknown[]) {
  const res = await fetch(SURF, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { error?: unknown; result?: unknown };
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function wallet(skr: bigint): Promise<KeyPairSigner> {
  const signer = await generateKeyPairSigner();
  await cheat("surfnet_setAccount", [signer.address, { lamports: 10_000_000_000 }]);
  await cheat("surfnet_setTokenAccount", [signer.address, SKR, { amount: Number(skr), state: "initialized" }]);
  return signer;
}

async function fakeMint(holder: Address): Promise<Address> {
  const mint = (await generateKeyPairSigner()).address;
  const data = new Uint8Array(82);
  data[44] = 6;
  data[45] = 1;
  await cheat("surfnet_setAccount", [
    mint,
    { lamports: 1_461_600, owner: TOKEN_PROGRAM_ID, data: Buffer.from(data).toString("hex") },
  ]);
  await cheat("surfnet_setTokenAccount", [holder, mint, { amount: 10_000_000, state: "initialized" }]);
  return mint;
}

async function now(): Promise<bigint> {
  const { value } = await rpc
    .getAccountInfo(address("SysvarC1ock11111111111111111111111111111111"), { encoding: "base64" })
    .send();
  return Buffer.from(value!.data[0], "base64").readBigInt64LE(32);
}

async function build(payer: KeyPairSigner, ix: Instruction) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions([ix], m),
  );
  return signTransactionMessageWithSigners(message);
}

async function simulateError(payer: KeyPairSigner, ix: Instruction): Promise<unknown> {
  const tx = await build(payer, ix);
  const { value } = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", sigVerify: true })
    .send();
  return value.err;
}

async function send(payer: KeyPairSigner, ix: Instruction): Promise<Signature> {
  assert.equal(await simulateError(payer, ix), null, "simulation should succeed");
  const tx = await build(payer, ix);
  await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64" }).send();
  const signature = getSignatureFromTransaction(tx);
  for (let i = 0; i < 50; i++) {
    const { value } = await rpc.getSignatureStatuses([signature]).send();
    if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") {
      assert.equal(value[0].err, null);
      return signature;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("transaction did not confirm");
}

const custom = (code: number) => ({ InstructionError: [0, { Custom: code }] });
const errorCode = (err: unknown) => JSON.parse(JSON.stringify(err, (_, v) => (typeof v === "bigint" ? Number(v) : v)));

async function balance(owner: Address): Promise<bigint> {
  const { value } = await rpc.getTokenAccountBalance(await associatedTokenAddress(owner, SKR)).send();
  return BigInt(value.amount);
}

async function exists(account: Address) {
  return (await rpc.getAccountInfo(account, { encoding: "base64" }).send()).value !== null;
}

async function bountyFor(poster: KeyPairSigner, amount: bigint, hours: bigint, mint: Address = SKR): Promise<EscrowBounty> {
  return { id: crypto.randomUUID(), poster: poster.address, mint, amount, expiresAt: (await now()) + hours * HOUR };
}

const results: string[] = [];
async function check(name: string, run: () => Promise<void>) {
  await run();
  results.push(`ok  ${name}`);
}

const alice = await wallet(100_000_000n);
const bob = await wallet(0n);

await check("rejects a zero reward", async () => {
  const b = await bountyFor(alice, 0n, 24n);
  assert.deepEqual(errorCode(await simulateError(alice, await createBountyInstruction(b))), custom(6000));
});

await check("rejects an unsupported mint", async () => {
  const mint = await fakeMint(alice.address);
  const b = await bountyFor(alice, 1_000_000n, 24n, mint);
  assert.deepEqual(errorCode(await simulateError(alice, await createBountyInstruction(b))), custom(6001));
});

await check("rejects expiry shorter than 1 hour or longer than 30 days", async () => {
  for (const hours of [0n, 24n * 31n]) {
    const b = await bountyFor(alice, 1_000_000n, hours);
    assert.deepEqual(errorCode(await simulateError(alice, await createBountyInstruction(b))), custom(6002));
  }
});

await check("rejects a reward larger than the poster's balance", async () => {
  const b = await bountyFor(alice, 200_000_000n, 24n);
  assert.notEqual(await simulateError(alice, await createBountyInstruction(b)), null);
});

const cancelled = await bountyFor(alice, 5_000_000n, 24n);
let cancelledSig: Signature;
await check("locks the reward in a PDA-owned vault and passes server verification", async () => {
  cancelledSig = await send(alice, await createBountyInstruction(cancelled));
  const pda = await bountyAddress(alice.address, cancelled.id);
  assert.equal(await balance(alice.address), 95_000_000n);
  assert.equal(await balance(pda), 5_000_000n);
  assert.equal(await checkEscrow(rpc, cancelled, cancelledSig), "funded");
});

await check("server verification rejects a different amount than the chain holds", async () => {
  assert.equal(await checkEscrow(rpc, { ...cancelled, amount: 6_000_000n }, cancelledSig), "mismatch");
});

await check("cannot create the same bounty id twice", async () => {
  assert.notEqual(await simulateError(alice, await createBountyInstruction(cancelled)), null);
});

await check("only the poster can cancel", async () => {
  const ix = await cancelBountyInstruction(cancelled);
  const asBob: Instruction = {
    ...ix,
    accounts: ix.accounts!.map((meta, i) =>
      i === 0 ? { ...meta, address: bob.address } : i === 1 ? { ...meta, role: AccountRole.WRITABLE } : meta,
    ),
  };
  assert.deepEqual(errorCode(await simulateError(bob, asBob)), custom(6003));
});

await check("an open bounty cannot be refunded as expired", async () => {
  const ix = await refundExpiredInstruction(bob.address, cancelled);
  assert.deepEqual(errorCode(await simulateError(bob, ix)), custom(6004));
});

await check("the poster can cancel: full refund, vault and bounty closed", async () => {
  await send(alice, await cancelBountyInstruction(cancelled));
  const pda = await bountyAddress(alice.address, cancelled.id);
  assert.equal(await balance(alice.address), 100_000_000n);
  assert.equal(await exists(pda), false);
  assert.equal(await exists(await associatedTokenAddress(pda, SKR)), false);
  assert.equal(await checkEscrow(rpc, cancelled, cancelledSig), "not_found");
});

await check("anyone can return an expired bounty to its poster", async () => {
  const expiring = await bountyFor(alice, 7_000_000n, 1n);
  await send(alice, await createBountyInstruction(expiring));
  assert.equal(await balance(alice.address), 93_000_000n);
  await cheat("surfnet_timeTravel", [{ absoluteTimestamp: Number((expiring.expiresAt + 60n) * 1000n) }]);
  assert.ok((await now()) >= expiring.expiresAt, "clock should be past expiry");
  await send(bob, await refundExpiredInstruction(bob.address, expiring));
  assert.equal(await balance(alice.address), 100_000_000n);
  assert.equal(await exists(await bountyAddress(alice.address, expiring.id)), false);
});

console.log(results.join("\n"));
console.log(`\n${results.length} escrow checks passed`);
