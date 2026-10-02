import { AccountRole, getAddressEncoder, type Address, type Instruction } from "@solana/kit";

import { associatedTokenAddress, claimAddress, ESCROW_PROGRAM_ID, reviewAddress, reviewConfigAddress } from "./escrow";

const TOKEN = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const ATA = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;
const SYSTEM = "11111111111111111111111111111111" as Address;
export const settlementDiscriminators = {
  attest: [237, 118, 24, 150, 224, 158, 95, 181],
  dispute: [14, 68, 210, 80, 112, 83, 155, 183],
  approve: [17, 171, 252, 175, 75, 86, 76, 96],
  release: [29, 47, 2, 11, 242, 151, 250, 118],
  resolve: [231, 6, 202, 6, 96, 103, 12, 230],
};

export function digestBytes(hex: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Invalid digest");
  return Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
}

export async function attestInstruction(attester: Address, bounty: Address, scout: Address, digest: string): Promise<Instruction> {
  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: attester, role: AccountRole.WRITABLE_SIGNER },
      { address: await reviewConfigAddress(), role: AccountRole.READONLY },
      { address: bounty, role: AccountRole.READONLY },
      { address: await claimAddress(bounty), role: AccountRole.READONLY },
      { address: await reviewAddress(bounty), role: AccountRole.WRITABLE },
      { address: SYSTEM, role: AccountRole.READONLY },
    ],
    data: Uint8Array.from([...settlementDiscriminators.attest, ...getAddressEncoder().encode(scout), ...digestBytes(digest)]),
  };
}

export async function disputeInstruction(poster: Address, bounty: Address, reason: string): Promise<Instruction> {
  return {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: poster, role: AccountRole.READONLY_SIGNER },
      { address: bounty, role: AccountRole.READONLY },
      { address: await reviewAddress(bounty), role: AccountRole.WRITABLE },
    ],
    data: Uint8Array.from([...settlementDiscriminators.dispute, ...digestBytes(reason)]),
  };
}

export type SettlementTerms = { bounty: Address; poster: Address; mint: Address; recipient: Address };
export async function settlementInstructions(
  signer: Address, terms: SettlementTerms, action: "approve" | "release" | "resolve", resolution?: { payScout: boolean; digest: string },
): Promise<Instruction[]> {
  const ata = await associatedTokenAddress(terms.recipient, terms.mint);
  return [{
    programAddress: ATA,
    accounts: [
      { address: signer, role: AccountRole.WRITABLE_SIGNER },
      { address: ata, role: AccountRole.WRITABLE },
      { address: terms.recipient, role: AccountRole.READONLY },
      { address: terms.mint, role: AccountRole.READONLY },
      { address: SYSTEM, role: AccountRole.READONLY },
      { address: TOKEN, role: AccountRole.READONLY },
    ],
    data: Uint8Array.of(1),
  }, {
    programAddress: ESCROW_PROGRAM_ID,
    accounts: [
      { address: signer, role: AccountRole.READONLY_SIGNER },
      { address: await reviewConfigAddress(), role: AccountRole.READONLY },
      { address: terms.poster, role: AccountRole.WRITABLE },
      { address: terms.mint, role: AccountRole.READONLY },
      { address: terms.recipient, role: AccountRole.READONLY },
      { address: ata, role: AccountRole.WRITABLE },
      { address: terms.bounty, role: AccountRole.WRITABLE },
      { address: await associatedTokenAddress(terms.bounty, terms.mint), role: AccountRole.WRITABLE },
      { address: await reviewAddress(terms.bounty), role: AccountRole.WRITABLE },
      { address: TOKEN, role: AccountRole.READONLY },
    ],
    data: Uint8Array.from([
      ...settlementDiscriminators[action],
      ...(action === "resolve" && resolution ? [Number(resolution.payScout), ...digestBytes(resolution.digest)] : []),
    ]),
  }];
}
