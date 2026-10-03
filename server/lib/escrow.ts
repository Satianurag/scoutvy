import {
  address,
  getAddressDecoder,
  getI64Decoder,
  getU64Decoder,
  type Address,
  type GetAccountInfoApi,
  type GetSignaturesForAddressApi,
  type GetSignatureStatusesApi,
  type GetTransactionApi,
  type Rpc,
  type Signature,
} from "@solana/kit";

import { associatedTokenAddress, bountyAddress, ESCROW_PROGRAM_ID, TOKEN_PROGRAM_ID, uuidBytes } from "./escrow-instructions.js";
import { tokenBalance, type WalletRpc } from "./wallet.js";

export { associatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, bountyAddress, ESCROW_PROGRAM_ID, TOKEN_PROGRAM_ID, uuidBytes } from "./escrow-instructions.js";

// Reward tokens the devnet escrow accepts. SKR has no devnet deployment, so a Scoutvy-controlled
// test mint with the same decimals stands in for it; USDC is Circle's devnet mint.
// https://developers.circle.com/stablecoins/usdc-contract-addresses
export const BOUNTY_TOKENS = [
  { mint: address("CyM9goaWp8XqCF1hCbuE2X8nJXcTwFY36b9aWaZZbbhq"), symbol: "SKR", decimals: 6 },
  { mint: address("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), symbol: "USDC", decimals: 6 },
] as const;

const BOUNTY_DISCRIMINATOR = [237, 16, 105, 198, 19, 69, 242, 234];
const BOUNTY_ACCOUNT_SIZE = 8 + 32 + 32 + 16 + 8 + 8 + 8 + 1;

export type EscrowRpc = Rpc<GetAccountInfoApi & GetSignatureStatusesApi & GetTransactionApi>;

export type OnChainBounty = {
  poster: Address;
  mint: Address;
  id: Uint8Array;
  amount: bigint;
  createdAt: bigint;
  expiresAt: bigint;
};

export function decodeBounty(data: Uint8Array): OnChainBounty | null {
  if (data.length !== BOUNTY_ACCOUNT_SIZE) return null;
  if (BOUNTY_DISCRIMINATOR.some((byte, i) => data[i] !== byte)) return null;
  const addresses = getAddressDecoder();
  return {
    poster: addresses.decode(data.subarray(8, 40)),
    mint: addresses.decode(data.subarray(40, 72)),
    id: data.slice(72, 88),
    amount: getU64Decoder().decode(data.subarray(88, 96)),
    createdAt: getI64Decoder().decode(data.subarray(96, 104)),
    expiresAt: getI64Decoder().decode(data.subarray(104, 112)),
  };
}

export type ExpectedBounty = { id: string; poster: Address; mint: Address; amount: bigint; expiresAt: bigint };

export type EscrowCheck = "funded" | "not_found" | "mismatch" | "unconfirmed" | "failed";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Confirms that `signature` landed successfully, touched the bounty PDA, and that the PDA plus its
 * vault now hold exactly what the database row describes.
 */
export async function checkEscrow(rpc: EscrowRpc, expected: ExpectedBounty, signature: Signature): Promise<EscrowCheck> {
  const pda = await bountyAddress(expected.poster, expected.id);

  const { value: statuses } = await rpc.getSignatureStatuses([signature], { searchTransactionHistory: true }).send();
  const status = statuses[0];
  if (!status || (status.confirmationStatus !== "confirmed" && status.confirmationStatus !== "finalized")) {
    return "unconfirmed";
  }
  if (status.err) return "failed";

  const tx = await rpc
    .getTransaction(signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
    .send();
  if (!tx || tx.meta?.err) return "failed";
  const keys = tx.transaction.message.accountKeys;
  if (!keys.includes(pda) || !keys.includes(ESCROW_PROGRAM_ID)) return "mismatch";

  return checkCurrentEscrow(rpc, expected);
}

export async function checkCurrentEscrow(
  rpc: Rpc<GetAccountInfoApi>,
  expected: ExpectedBounty,
): Promise<"funded" | "not_found" | "mismatch"> {
  const pda = await bountyAddress(expected.poster, expected.id);
  const { value: account } = await rpc.getAccountInfo(pda, { commitment: "confirmed", encoding: "base64" }).send();
  if (!account) return "not_found";
  if (account.owner !== ESCROW_PROGRAM_ID) return "mismatch";
  const bounty = decodeBounty(Uint8Array.from(Buffer.from(account.data[0], "base64")));
  const id = uuidBytes(expected.id);
  if (
    !bounty ||
    bounty.poster !== expected.poster ||
    bounty.mint !== expected.mint ||
    bounty.amount !== expected.amount ||
    bounty.expiresAt !== expected.expiresAt ||
    bounty.id.some((byte, i) => byte !== id[i])
  ) {
    return "mismatch";
  }

  const vaultAddress = await associatedTokenAddress(pda, expected.mint);
  const { value: vault } = await rpc
    .getAccountInfo(vaultAddress, { commitment: "confirmed", encoding: "jsonParsed" })
    .send();
  const parsed = vault && isObject(vault.data) && isObject(vault.data.parsed) ? vault.data.parsed : null;
  const info = parsed && isObject(parsed.info) ? parsed.info : null;
  const amount = info && isObject(info.tokenAmount) ? info.tokenAmount.amount : undefined;
  if (
    vault?.owner !== TOKEN_PROGRAM_ID ||
    info?.mint !== expected.mint ||
    info.owner !== pda ||
    typeof amount !== "string" ||
    BigInt(amount) < expected.amount
  ) {
    return "mismatch";
  }
  return "funded";
}

export type BountyTokenBalance = { mint: Address; symbol: string; decimals: number; amount: string };

/** Devnet balances of every token a bounty can be funded with. */
export async function getBountyTokens(rpc: WalletRpc, owner: Address): Promise<BountyTokenBalance[]> {
  return Promise.all(
    BOUNTY_TOKENS.map(async (token) => ({ ...token, amount: (await tokenBalance(rpc, owner, token.mint)).toString() })),
  );
}

export type CloseCheck = { status: "closed"; signature: Signature; closedAt: Date } | { status: "still_open" | "unconfirmed" };

const CLOSE_LOGS = ["Program log: Instruction: CancelBounty", "Program log: Instruction: RefundExpired"];

export type CloseRpc = Rpc<GetAccountInfoApi & GetSignaturesForAddressApi & GetTransactionApi>;

/**
 * Finds the transaction that closed a bounty PDA: the account must be gone and the PDA's most recent
 * successful transaction must be an escrow cancel or expired refund.
 */
export async function checkClosed(rpc: CloseRpc, poster: Address, id: string): Promise<CloseCheck> {
  const pda = await bountyAddress(poster, id);
  const { value: account } = await rpc.getAccountInfo(pda, { commitment: "confirmed", encoding: "base64" }).send();
  if (account) return { status: "still_open" };

  const signatures = await rpc.getSignaturesForAddress(pda, { commitment: "confirmed", limit: 10 }).send();
  for (const entry of signatures) {
    if (entry.err) continue;
    const tx = await rpc
      .getTransaction(entry.signature, { commitment: "confirmed", encoding: "json", maxSupportedTransactionVersion: 0 })
      .send();
    if (!tx || tx.meta?.err) continue;
    const keys = tx.transaction.message.accountKeys;
    if (!keys.includes(pda) || !keys.includes(ESCROW_PROGRAM_ID)) continue;
    if (!(tx.meta?.logMessages ?? []).some((line) => CLOSE_LOGS.includes(line))) continue;
    const blockTime = tx.blockTime ?? entry.blockTime;
    return { status: "closed", signature: entry.signature, closedAt: blockTime ? new Date(Number(blockTime) * 1000) : new Date() };
  }
  return { status: "unconfirmed" };
}
