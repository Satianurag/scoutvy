import {
  AccountRole,
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Rpc,
  type SimulateTransactionApi,
  type GetLatestBlockhashApi,
  getAddressEncoder,
  getI64Encoder,
  getProgramDerivedAddress,
  getU64Encoder,
  type Address,
  type Instruction,
} from "@solana/kit";

export const ESCROW_PROGRAM_ID = address("BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn");
const TOKEN_PROGRAM_ID = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM_ID = address("11111111111111111111111111111111");

const CREATE_BOUNTY_DISCRIMINATOR = [122, 90, 14, 143, 8, 125, 200, 2];
const CANCEL_BOUNTY_DISCRIMINATOR = [79, 65, 107, 143, 128, 165, 135, 46];
const REFUND_EXPIRED_DISCRIMINATOR = [118, 153, 164, 244, 40, 128, 242, 250];

export function uuidBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error("invalid uuid");
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
}

export async function bountyAddress(poster: Address, id: string): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({
    programAddress: ESCROW_PROGRAM_ID,
    seeds: ["bounty", getAddressEncoder().encode(poster), uuidBytes(id)],
  });
  return pda;
}

export async function associatedTokenAddress(owner: Address, mint: Address): Promise<Address> {
  const encoder = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ID,
    seeds: [encoder.encode(owner), encoder.encode(TOKEN_PROGRAM_ID), encoder.encode(mint)],
  });
  return ata;
}

export async function reviewAddress(bounty: Address): Promise<Address> {
  return (await getProgramDerivedAddress({
    programAddress: ESCROW_PROGRAM_ID, seeds: ["review", getAddressEncoder().encode(bounty)],
  }))[0];
}

export async function reviewConfigAddress(): Promise<Address> {
  return (await getProgramDerivedAddress({ programAddress: ESCROW_PROGRAM_ID, seeds: ["review_config"] }))[0];
}

export type EscrowBounty = { id: string; poster: Address; mint: Address; amount: bigint; expiresAt: bigint };

/** Locks `amount` of the poster's `mint` in a vault owned by the bounty PDA. */
export async function createBountyInstruction(bounty: EscrowBounty): Promise<Instruction> {
  const pda = await bountyAddress(bounty.poster, bounty.id);
  const data = Uint8Array.from([
    ...CREATE_BOUNTY_DISCRIMINATOR,
    ...uuidBytes(bounty.id),
    ...getU64Encoder().encode(bounty.amount),
    ...getI64Encoder().encode(bounty.expiresAt),
  ]);
  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: bounty.poster, role: AccountRole.WRITABLE_SIGNER },
      { address: bounty.mint, role: AccountRole.READONLY },
      { address: await associatedTokenAddress(bounty.poster, bounty.mint), role: AccountRole.WRITABLE },
      { address: pda, role: AccountRole.WRITABLE },
      { address: await associatedTokenAddress(pda, bounty.mint), role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
      { address: ASSOCIATED_TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
      { address: SYSTEM_PROGRAM_ID, role: AccountRole.READONLY },
      { address: await reviewAddress(pda), role: AccountRole.READONLY },
    ],
    data,
  };
}

async function refundInstruction(
  discriminator: number[],
  signer: Address,
  bounty: Pick<EscrowBounty, "id" | "poster" | "mint">,
): Promise<Instruction> {
  const pda = await bountyAddress(bounty.poster, bounty.id);
  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: signer, role: signer === bounty.poster ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER },
      { address: bounty.poster, role: signer === bounty.poster ? AccountRole.WRITABLE_SIGNER : AccountRole.WRITABLE },
      { address: bounty.mint, role: AccountRole.READONLY },
      { address: await associatedTokenAddress(bounty.poster, bounty.mint), role: AccountRole.WRITABLE },
      { address: pda, role: AccountRole.WRITABLE },
      { address: await associatedTokenAddress(pda, bounty.mint), role: AccountRole.WRITABLE },
      { address: TOKEN_PROGRAM_ID, role: AccountRole.READONLY },
      { address: await reviewAddress(pda), role: AccountRole.READONLY },
    ],
    data: Uint8Array.from(discriminator),
  };
}

/** Returns the full vault to the poster and closes the bounty. Poster-only. */
export function cancelBountyInstruction(bounty: Pick<EscrowBounty, "id" | "poster" | "mint">) {
  return refundInstruction(CANCEL_BOUNTY_DISCRIMINATOR, bounty.poster, bounty);
}

/** Anyone may return an expired bounty's vault to its poster. */
export function refundExpiredInstruction(signer: Address, bounty: Pick<EscrowBounty, "id" | "poster" | "mint">) {
  return refundInstruction(REFUND_EXPIRED_DISCRIMINATOR, signer, bounty);
}

export type SimulationResult = "ok" | "no_sol" | "no_tokens" | "failed";

const TOKEN_INSUFFICIENT_FUNDS = 1;

/** Dry-runs the instructions with the poster as fee payer so failures surface before the wallet opens. */
export async function simulate(
  rpc: Rpc<SimulateTransactionApi & GetLatestBlockhashApi>,
  payer: Address,
  instructions: Instruction[],
): Promise<SimulationResult> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  const transaction = compileTransaction(
    pipe(
      createTransactionMessage({ version: 0 }),
      (tx) => setTransactionMessageFeePayer(payer, tx),
      (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
      (tx) => appendTransactionMessageInstructions(instructions, tx),
    ),
  );
  const { value } = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(transaction), {
      encoding: "base64",
      sigVerify: false,
      replaceRecentBlockhash: true,
    })
    .send();
  if (value.err === null) return "ok";
  const err = JSON.stringify(value.err, (_, v: unknown) => (typeof v === "bigint" ? Number(v) : v));
  if (/AccountNotFound|InsufficientFundsForFee|InsufficientFundsForRent/.test(err)) return "no_sol";
  if (err.includes(`"Custom":${TOKEN_INSUFFICIENT_FUNDS}}`)) return "no_tokens";
  if ((value.logs ?? []).some((line) => /insufficient lamports/i.test(line))) return "no_sol";
  return "failed";
}
