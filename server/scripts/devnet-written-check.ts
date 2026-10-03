/** Real Devnet/public-API driver. Never imports DB, attester, or resolver credentials. */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import {
  address, appendTransactionMessageInstructions, createKeyPairSignerFromBytes, createSolanaRpc,
  createTransactionMessage, generateKeyPairSigner, getAddressEncoder, getBase64EncodedWireTransaction,
  getSignatureFromTransaction, lamports, pipe, setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash, signBytes, signTransactionMessageWithSigners,
  AccountRole, getU32Encoder, getU64Encoder, type Instruction, type KeyPairSigner, type Signature,
} from "@solana/kit";
import { createSignInMessage } from "@solana/wallet-standard-util";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import { associatedTokenAddress, cancelBountyInstruction, claimInstruction, createBountyInstruction } from "../lib/escrow-instructions.js";
import { settlementInstructions } from "../lib/settlement-instructions.js";
import { readClaim } from "../lib/claims.js";

const API = "https://scoutvy.vercel.app";
const rpc = createSolanaRpc("https://api.devnet.solana.com");
const credentials = new URL("../../credentials/", import.meta.url);
const keyFile = new URL("devnet-written-check-scout.json", credentials);
const faucetMarker = new URL("devnet-written-check-faucet-attempted", credentials);
let stage = "initialize";
const output = (value: Record<string, unknown>) => console.log(JSON.stringify(value));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function signer(file = keyFile): Promise<KeyPairSigner> {
  await mkdir(credentials, { recursive: true, mode: 0o700 });
  try {
    const mode = (await stat(file)).mode & 0o777;
    if (mode !== 0o600) throw new Error("unsafe_key_permissions");
    const bytes: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(bytes) || bytes.length !== 64 || bytes.some((x) => !Number.isInteger(x) || x < 0 || x > 255))
      throw new Error("invalid_key_file");
    return createKeyPairSignerFromBytes(Uint8Array.from(bytes));
  } catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    const fresh = await generateKeyPairSigner(true);
    const exported = new Uint8Array(await crypto.subtle.exportKey("pkcs8", fresh.keyPair.privateKey));
    const secret = [...exported.slice(-32), ...getAddressEncoder().encode(fresh.address)];
    await writeFile(file, JSON.stringify(secret), { flag: "wx", mode: 0o600 });
    return fresh;
  }
}

async function request<T>(path: string, token?: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<T> {
  const response = await fetch(API + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: unknown };
    const code = typeof result.error === "string" && /^[a-z_]+$/.test(result.error) ? result.error : "request_failed";
    throw new Error(`http_${response.status}_${code}`);
  }
  return response.json() as Promise<T>;
}

async function authenticate(scout: KeyPairSigner, quiet = false) {
  stage = "siws";
  const payload = await request<SolanaSignInInput & { nonce: string; domain: string }>("/api/auth/siws/payload", undefined, {}, "POST");
  if (payload.domain !== "scoutvy.vercel.app" || payload.uri !== API) throw new Error("wrong_sign_in_origin");
  const message = createSignInMessage({ ...payload, address: scout.address });
  const sig = await signBytes(scout.keyPair.privateKey, message);
  const result = await request<{ token: string; walletAddress: string }>("/api/auth/siws/verify", undefined, {
    nonce: payload.nonce,
    signInResult: {
      address: Buffer.from(getAddressEncoder().encode(scout.address)).toString("base64"),
      signature: Buffer.from(sig).toString("base64"),
      signed_message: Buffer.from(message).toString("base64"),
    },
  });
  if (result.walletAddress !== scout.address) throw new Error("session_wallet_mismatch");
  if (!quiet) output({ address: scout.address, status: "authenticated" });
  return result.token;
}

async function confirmed(signature: Signature) {
  for (let i = 0; i < 30; i++) {
    const { value } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
    if (value[0]?.err) throw new Error("transaction_failed");
    if (value[0]?.confirmationStatus === "confirmed" || value[0]?.confirmationStatus === "finalized") return;
    await pause(1000);
  }
  throw new Error("confirmation_pending");
}

async function prepare(scout: KeyPairSigner) {
  output({ address: scout.address, status: "wallet_ready" });
  stage = "faucet";
  try {
    await writeFile(faucetMarker, "One Devnet faucet attempt authorized for this integration wallet.\n", { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "EEXIST") {
      output({ address: scout.address, status: "faucet_already_attempted" }); return;
    }
    throw error;
  }
  try {
    const signature = await rpc.requestAirdrop(scout.address, lamports(1_000_000_000n)).send();
    output({ address: scout.address, signature, status: "airdrop_sent" });
    await confirmed(signature);
    output({ address: scout.address, status: "airdrop_confirmed" });
  } catch {
    output({ address: scout.address, status: "faucet_unavailable_needs_devnet_sol" });
  }
}

type Scout = { status: string; bountyAddress?: string; expiresAt?: string };
type Review = { status: string; protected: boolean; role: string; proofType: string; writtenText: string | null; signature: string | null; deadline: string | null };
async function review(id: string, token: string) {
  const { review } = await request<{ review: Review }>(`/api/bounties?action=review&id=${id}`, token);
  output({ status: `review_${review.status}_${review.protected ? "secured" : "unsecured"}`, deadline: review.deadline, ...(review.signature ? { signature: review.signature } : {}) });
  return review;
}


const USDC = address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const lifecycleFile = new URL("devnet-token-lifecycle-state.json", credentials);
type Posted = { id: string; bountyAddress: string; expiresAt: string; status: string };
type LifecycleState = {
  poster: string; scout: string; signatures: Record<string, Signature>;
  cancellation?: Posted; payout?: Posted; cancelled?: boolean; paid?: boolean;
  before?: Awaited<ReturnType<typeof balances>>; afterCancel?: Awaited<ReturnType<typeof balances>>;
  after?: Awaited<ReturnType<typeof balances>>;
};
async function balances(poster: KeyPairSigner, scout: KeyPairSigner) {
  const result: Record<string, { address: string; lamports: string; usdcBaseUnits: string }> = {};
  for (const [role, wallet] of Object.entries({ poster, scout })) {
    const sol = await rpc.getBalance(wallet.address, { commitment: "confirmed" }).send();
    const ata = await associatedTokenAddress(wallet.address, USDC);
    const { value: account } = await rpc.getAccountInfo(ata, { encoding: "base64", commitment: "confirmed" }).send();
    const amount = account ? (await rpc.getTokenAccountBalance(ata, { commitment: "confirmed" }).send()).value.amount : "0";
    result[role] = { address: wallet.address, lamports: sol.value.toString(), usdcBaseUnits: amount };
  }
  return result;
}
async function lifecycle(poster: KeyPairSigner, execute: boolean) {
  const scout = await signer(new URL("devnet-token-lifecycle-scout.json", credentials));
  let state: LifecycleState;
  try { state = JSON.parse(await readFile(lifecycleFile, "utf8")) as LifecycleState; }
  catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    state = { poster: poster.address, scout: scout.address, signatures: {} };
  }
  if (state.poster !== poster.address || state.scout !== scout.address) throw new Error("lifecycle_wallet_mismatch");
  const save = () => writeFile(lifecycleFile, JSON.stringify(state, null, 2), { mode: 0o600 });
  const current = await balances(poster, scout);
  output({ status: "lifecycle_prepared", balances: current });
  if (!execute) return;
  if (!state.before) {
    if (BigInt(current.poster.lamports) < 10_000_000n || BigInt(current.poster.usdcBaseUnits) < 1_000_000n)
      throw new Error("needs_existing_devnet_funding");
    state.before = current; await save();
  }
  // Journal the signature before broadcast. On interruption, only reconcile that exact transaction.
  const send = async (label: string, payer: KeyPairSigner, instructions: Instruction[]) => {
    stage = label;
    const previous = state.signatures[label];
    if (previous) { await confirmed(previous); return previous; }
    const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const tx = await signTransactionMessageWithSigners(pipe(createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
      (m) => appendTransactionMessageInstructions(instructions, m)));
    const wire = getBase64EncodedWireTransaction(tx);
    const simulation = await rpc.simulateTransaction(wire, { encoding: "base64", commitment: "confirmed", sigVerify: true }).send();
    if (simulation.value.err) throw new Error(`${label}_simulation_failed`);
    const signature = getSignatureFromTransaction(tx);
    state.signatures[label] = signature; await save();
    await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
    output({ status: label, signature });
    await confirmed(signature);
    return signature;
  };
  const posterToken = await authenticate(poster);
  const scoutToken = await authenticate(scout);
  const create = async (kind: "cancellation" | "payout") => {
    if (!state[kind]) {
      stage = `${kind}_prepare`;
      const { bounty } = await request<{ bounty: Posted }>("/api/bounties", posterToken, {
        title: kind === "cancellation" ? "Devnet cancellation verification" : "Devnet written payout verification",
        instructions: kind === "cancellation"
          ? "Operator integration check: fund this reward then cancel it before acceptance and verify its return."
          : "Complete the public wallet sign-in, acceptance and written submission integration check. Explain the completed steps in your response.",
        taskMode: "remote", proofType: "written", latitude: null, longitude: null, locationLabel: null, radiusM: null,
        mint: USDC, amount: "1000000", durationHours: 6,
      });
      state[kind] = bounty; await save();
    }
    const bounty = state[kind]!;
    const signature = await send(`${kind}_fund`, poster, [await createBountyInstruction({
      id: bounty.id, poster: poster.address, mint: USDC, amount: 1_000_000n,
      expiresAt: BigInt(Math.floor(Date.parse(bounty.expiresAt) / 1000)),
    })]);
    if (bounty.status === "pending") {
      const { bounty: opened } = await request<{ bounty: Posted }>("/api/bounties/confirm", posterToken, { id: bounty.id, signature });
      state[kind] = opened; await save();
    }
    return bounty;
  };
  // Reuse the same supported test token: verify refund first, then pay it to a separate scout.
  if (!state.cancelled) {
    const bounty = await create("cancellation");
    await send("cancellation_refund", poster, [await cancelBountyInstruction({ id: bounty.id, poster: poster.address, mint: USDC })]);
    const { bounty: closed } = await request<{ bounty: Posted }>("/api/bounties/close", posterToken, { id: bounty.id });
    if (closed.status !== "cancelled") throw new Error("cancellation_not_confirmed");
    state.cancellation = closed;
    state.afterCancel = await balances(poster, scout);
    if (state.afterCancel.poster.usdcBaseUnits !== state.before.poster.usdcBaseUnits) throw new Error("refund_balance_mismatch");
    state.cancelled = true; await save(); output({ status: "cancellation_verified" });
  }
  if (!state.paid) {
    if (!state.signatures.scout_fee_funding) {
      if (BigInt((await rpc.getBalance(scout.address, { commitment: "confirmed" }).send()).value) !== 0n)
        throw new Error("unexpected_scout_balance");
      await send("scout_fee_funding", poster, [{
        programAddress: address("11111111111111111111111111111111"),
        accounts: [{ address: poster.address, role: AccountRole.WRITABLE_SIGNER }, { address: scout.address, role: AccountRole.WRITABLE }],
        data: Uint8Array.from([...getU32Encoder().encode(2), ...getU64Encoder().encode(3_000_000n)]),
      }]);
    } else await confirmed(state.signatures.scout_fee_funding);
    const bounty = await create("payout");
    stage = "accept";
    let { scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=scout&id=${bounty.id}`, scoutToken);
    if (accepted.status === "available") ({ scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=accept&id=${bounty.id}`, scoutToken, {}));
    if (accepted.status === "reserved") {
      if (!accepted.bountyAddress || !accepted.expiresAt) throw new Error("invalid_reservation");
      await send("payout_acceptance", scout, [await claimInstruction(scout.address, address(accepted.bountyAddress), BigInt(Math.floor(Date.parse(accepted.expiresAt) / 1000)))]);
      ({ scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=confirm-claim&id=${bounty.id}`, scoutToken, {}));
    }
    const text = "Completed the requested integration check using real public wallet sign-in, a signed Devnet acceptance transaction, and this written submission. No location or photo was fabricated. This run verifies backend and contract behavior; it does not claim Android wallet approval was exercised.";
    stage = "payout_written_submission";
    if (accepted.status !== "submitted") await request(`/api/bounties?action=written-proof&id=${bounty.id}`, scoutToken, { text });
    const initial = await review(bounty.id, scoutToken);
    if (initial.writtenText !== text || !initial.protected) throw new Error("written_protection_not_verified");
    stage = "payout_prepare_approval";
    const prepared = await request<{ transaction: { bounty: string; poster: string; recipient: string; mint: string } | null; review: Review }>(`/api/bounties?action=approve&id=${bounty.id}`, posterToken, {});
    if (prepared.transaction) {
      const t = prepared.transaction;
      if (t.poster !== poster.address || t.recipient !== scout.address || t.mint !== USDC || t.bounty !== bounty.bountyAddress)
        throw new Error("approval_terms_mismatch");
      const signature = await send("payout_approval", poster, await settlementInstructions(poster.address, {
        bounty: address(t.bounty), poster: poster.address, recipient: scout.address, mint: USDC,
      }, "approve"));
      stage = "payout_record";
      await request(`/api/bounties?action=record-decision&id=${bounty.id}`, posterToken, { action: "approve", signature });
    }
    await request(`/api/bounties?action=retry-settlement&id=${bounty.id}`, scoutToken, {});
    const paid = await review(bounty.id, scoutToken);
    if (paid.status !== "paid" || !paid.signature) throw new Error("payout_not_verified");
    state.payout = { ...bounty, status: paid.status };
    state.after = await balances(poster, scout);
    if (BigInt(state.after.scout.usdcBaseUnits) - BigInt(state.before.scout.usdcBaseUnits) !== 1_000_000n
      || BigInt(state.before.poster.usdcBaseUnits) - BigInt(state.after.poster.usdcBaseUnits) !== 1_000_000n)
      throw new Error("payout_balance_mismatch");
    state.paid = true; await save();
  }
  const evidencePath = new URL("../../../scoutvy-ui-audit/refinement/evidence.json", import.meta.url);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
  evidence.backend_contract_lifecycle = {
    network: "devnet", token: "Circle Devnet USDC", amount: "1", ...state,
    verifiedAt: new Date().toISOString(), scope: "Public SIWS/API and real signed contract transactions; Android approval UI not verified.",
  };
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  output({ status: "backend_contract_lifecycle_verified", balances: state.after, signatures: state.signatures });
}


type UpgradeState = {
  poster: string; scout: string; signatures: Record<string, Signature>; bounty?: Posted;
  before?: Awaited<ReturnType<typeof balances>>; after?: Awaited<ReturnType<typeof balances>>;
  longClaim?: { acceptedAt: string; expiresAt: string; durationSeconds: number };
  released?: boolean; cancelled?: boolean;
  previousReceipts?: { id: string; status: string; protected: boolean; signature: string | null }[];
};
async function upgradeCheck(poster: KeyPairSigner, execute: boolean) {
  const scout = await signer(new URL("devnet-token-lifecycle-scout.json", credentials));
  const file = new URL("devnet-upgrade-check-state.json", credentials);
  let state: UpgradeState;
  try { state = JSON.parse(await readFile(file, "utf8")) as UpgradeState; }
  catch (error) {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") throw error;
    state = { poster: poster.address, scout: scout.address, signatures: {} };
  }
  if (state.poster !== poster.address || state.scout !== scout.address) throw new Error("upgrade_wallet_mismatch");
  const save = () => writeFile(file, JSON.stringify(state, null, 2), { mode: 0o600 });
  const current = await balances(poster, scout);
  const posterToken = await authenticate(poster);
  const scoutToken = await authenticate(scout);
  const previousReceipts = async () => {
    const found = [];
    for (const id of ["a9fa06ae-0dab-40a4-b338-f3a9d4333d68", "9bea3ab5-1ac8-4480-98db-1c853bb65917"]) {
      const result = await review(id, posterToken);
      if (result.status !== "paid" || !result.protected || !result.signature) throw new Error("previous_paid_receipt_unavailable");
      found.push({ id, status: result.status, protected: result.protected, signature: result.signature });
    }
    return found;
  };
  const oldReceipts = await previousReceipts();
  output({ status: "upgrade_check_prepared", balances: current, previousReceipts: oldReceipts });
  if (!execute) return;
  if (!state.before) {
    const claimRent = await rpc.getMinimumBalanceForRentExemption(89n).send();
    const systemRent = await rpc.getMinimumBalanceForRentExemption(0n).send();
    if (BigInt(current.poster.usdcBaseUnits) < 1_000_000n || BigInt(current.poster.lamports) < 4_000_000n
      || BigInt(current.scout.lamports) < claimRent + systemRent + 20_000n)
      throw new Error("insufficient_existing_upgrade_budget");
    state.before = current; await save();
  }
  // Journal the signature before broadcast. On interruption, only reconcile that exact transaction.
  const send = async (label: string, payer: KeyPairSigner, instructions: Instruction[]) => {
    stage = label;
    const previous = state.signatures[label];
    if (previous) { await confirmed(previous); return previous; }
    const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const tx = await signTransactionMessageWithSigners(pipe(createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
      (m) => appendTransactionMessageInstructions(instructions, m)));
    const wire = getBase64EncodedWireTransaction(tx);
    const simulation = await rpc.simulateTransaction(wire, { encoding: "base64", commitment: "confirmed", sigVerify: true }).send();
    if (simulation.value.err) throw new Error(`${label}_simulation_failed`);
    const signature = getSignatureFromTransaction(tx);
    state.signatures[label] = signature; await save();
    await rpc.sendTransaction(wire, { encoding: "base64", preflightCommitment: "confirmed" }).send();
    output({ status: label, signature });
    await confirmed(signature);
    return signature;
  };

  if (!state.bounty) {
    stage = "upgrade_prepare_bounty";
    const { bounty } = await request<{ bounty: Posted }>("/api/bounties", posterToken, {
      title: "Devnet long acceptance verification",
      instructions: "Verify a written bounty can be accepted for longer than one hour, then release the acceptance so the poster can cancel and recover the full test reward.",
      taskMode: "remote", proofType: "written", latitude: null, longitude: null, locationLabel: null, radiusM: null,
      mint: USDC, amount: "1000000", durationHours: 6,
    });
    state.bounty = bounty; await save();
  }
  let bounty = state.bounty;
  if (bounty.status === "pending") {
    const signature = await send("upgrade_funding", poster, [await createBountyInstruction({
      id: bounty.id, poster: poster.address, mint: USDC, amount: 1_000_000n,
      expiresAt: BigInt(Math.floor(Date.parse(bounty.expiresAt) / 1000)),
    })]);
    ({ bounty } = await request<{ bounty: Posted }>("/api/bounties/confirm", posterToken, { id: bounty.id, signature }));
    state.bounty = bounty; await save();
  }
  if (process.env.SCOUTVY_UPGRADE_PAUSE_AFTER_FUNDING === "true" && bounty.status === "open"
    && !state.signatures.upgrade_long_acceptance) {
    output({ status: "upgrade_funded_paused", bountyId: bounty.id, expiresAt: bounty.expiresAt });
    return;
  }
  if (!state.longClaim) {
    stage = "upgrade_reserve";
    let { scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=scout&id=${bounty.id}`, scoutToken);
    if (accepted.status === "available") ({ scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=accept&id=${bounty.id}`, scoutToken, {}));
    if (accepted.status === "reserved") {
      if (!accepted.bountyAddress || !accepted.expiresAt || Date.parse(accepted.expiresAt) - Date.now() <= 3_600_000)
        throw new Error("long_claim_api_gate_not_enabled");
      await send("upgrade_long_acceptance", scout, [await claimInstruction(scout.address, address(accepted.bountyAddress), BigInt(Math.floor(Date.parse(accepted.expiresAt) / 1000)))]);
      ({ scout: accepted } = await request<{ scout: Scout }>(`/api/bounties?action=confirm-claim&id=${bounty.id}`, scoutToken, {}));
    }
    const chain = await readClaim(rpc, bounty.bountyAddress);
    if (accepted.status !== "accepted" || !chain || chain.scout !== scout.address
      || chain.expiresAt.getTime() - chain.acceptedAt.getTime() <= 3_600_000
      || chain.expiresAt.getTime() > Date.parse(bounty.expiresAt)) throw new Error("long_claim_not_verified");
    state.longClaim = { acceptedAt: chain.acceptedAt.toISOString(), expiresAt: chain.expiresAt.toISOString(),
      durationSeconds: (chain.expiresAt.getTime() - chain.acceptedAt.getTime()) / 1000 };
    await save(); output({ status: "long_claim_verified", ...state.longClaim });
  }
  if (!state.released) {
    stage = "upgrade_release";
    let result = await request<{ released: boolean; bountyAddress: string | null }>(`/api/bounties?action=release&id=${bounty.id}`, scoutToken, {});
    if (!result.released) {
      if (result.bountyAddress !== bounty.bountyAddress) throw new Error("release_bounty_mismatch");
      await send("upgrade_release", scout, [await claimInstruction(scout.address, address(bounty.bountyAddress))]);
      result = await request(`/api/bounties?action=release&id=${bounty.id}`, scoutToken, {});
    }
    const chain = await readClaim(rpc, bounty.bountyAddress);
    if (!result.released || (chain && chain.expiresAt.getTime() > Date.now())) throw new Error("release_not_verified");
    state.released = true; await save();
  }
  if (!state.cancelled) {
    await send("upgrade_refund", poster, [await cancelBountyInstruction({ id: bounty.id, poster: poster.address, mint: USDC })]);
    const { bounty: closed } = await request<{ bounty: Posted }>("/api/bounties/close", posterToken, { id: bounty.id });
    if (closed.status !== "cancelled") throw new Error("upgrade_refund_not_confirmed");
    state.bounty = closed;
    state.after = await balances(poster, scout);
    if (state.after.poster.usdcBaseUnits !== state.before.poster.usdcBaseUnits
      || state.after.scout.usdcBaseUnits !== state.before.scout.usdcBaseUnits) throw new Error("upgrade_refund_balance_mismatch");
    state.cancelled = true; await save();
  }
  state.previousReceipts = await previousReceipts(); await save();
  const evidencePath = new URL("../../../scoutvy-ui-audit/refinement/evidence.json", import.meta.url);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as Record<string, unknown>;
  evidence.long_claim_upgrade_validation = { network: "devnet", ...state, verifiedAt: new Date().toISOString(),
    scope: "Public SIWS/API and real long-duration claim, release, cancellation; no photo/GPS assertions or Android UI claim." };
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
  output({ status: "upgrade_validation_complete", ...state });
}

async function main() {
  const [command, id] = process.argv.slice(2);
  if (!["--prepare", "--run", "--review", "--protect", "--lifecycle-prepare", "--lifecycle-run", "--upgrade-prepare", "--upgrade-run"].includes(command ?? "")) throw new Error("invalid_command");
  if (!command.startsWith("--upgrade-") && !command.startsWith("--lifecycle-") && command !== "--prepare" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? ""))
    throw new Error("invalid_bounty_id");
  const scout = await signer();
  if (command.startsWith("--upgrade-")) return upgradeCheck(scout, command === "--upgrade-run");
  if (command.startsWith("--lifecycle-")) return lifecycle(scout, command === "--lifecycle-run");
  if (command === "--prepare") return prepare(scout);
  const token = await authenticate(scout, command === "--protect");
  if (command === "--protect") {
    stage = "protect";
    const response = await fetch(`${API}/api/bounties?action=retry-settlement&id=${id}`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}", signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json().catch(() => ({})) as { error?: unknown };
    output({ httpStatus: response.status, errorCode: typeof body.error === "string" && /^[a-z_]+$/.test(body.error) ? body.error : null });
    return;
  }
  if (command === "--review") { stage = "review"; await review(id, token); return; }
  stage = "bounty";
  const { bounty } = await request<{ bounty: { mine: boolean; taskMode: string; proofType: string; mint: string; amount: string; status: string } }>(`/api/bounties?id=${id}`, token);
  if (bounty.mine || bounty.taskMode !== "remote" || bounty.proofType !== "written"
    || bounty.mint !== "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" || bounty.amount !== "1000000")
    throw new Error("bounty_outside_authorized_check");
  stage = "accept";
  let { scout: state } = await request<{ scout: Scout }>(`/api/bounties?action=accept&id=${id}`, token, {});
  if (state.status === "reserved") {
    if (!state.bountyAddress || !state.expiresAt) throw new Error("invalid_reservation");
    stage = "sign_acceptance";
    const instruction = await claimInstruction(scout.address, address(state.bountyAddress), BigInt(Math.floor(Date.parse(state.expiresAt) / 1000)));
    const { value: lifetime } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const tx = await signTransactionMessageWithSigners(pipe(createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(scout, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
      (m) => appendTransactionMessageInstructions([instruction], m)));
    const signature = getSignatureFromTransaction(tx);
    await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", preflightCommitment: "confirmed" }).send();
    output({ signature, status: "acceptance_sent" });
    await confirmed(signature);
    ({ scout: state } = await request<{ scout: Scout }>(`/api/bounties?action=confirm-claim&id=${id}`, token, {}));
  }
  if (state.status !== "accepted" && state.status !== "submitted") throw new Error("acceptance_not_ready");
  output({ status: state.status });
  stage = "written_submission";
  const text = process.env.SCOUTVY_CHECK_TEXT ?? "Completed the requested Devnet integration check: signed in through Scoutvy’s public wallet authentication API, accepted this bounty with a real signed Devnet transaction, and submitted this written response from a separate scout wallet. No photo or location data was invented.";
  if (state.status !== "submitted") {
    try {
      await request(`/api/bounties?action=written-proof&id=${id}`, token, { text });
    } catch (error) {
      const { scout: current } = await request<{ scout: Scout }>(`/api/bounties?action=scout&id=${id}`, token);
      if (current.status !== "submitted") throw error;
    }
  }
  stage = "review";
  const saved = await review(id, token);
  if (saved.role !== "scout" || saved.proofType !== "written" || saved.writtenText !== text) throw new Error("submission_mismatch");
  output({ address: scout.address, status: "written_submission_verified" });
}

main().catch((error: unknown) => {
  const code = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : "operation_failed";
  output({ status: `${stage}_${code}` });
  process.exitCode = 1;
});
