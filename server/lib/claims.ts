import { address, getAddressDecoder, type GetAccountInfoApi, type Rpc } from "@solana/kit";

import { claimAddress } from "./escrow-instructions.js";
import { ESCROW_PROGRAM_ID } from "./escrow.js";
import { ProofError } from "./proof-error.js";

export async function readClock(rpc: Rpc<GetAccountInfoApi>): Promise<Date> {
  const { value } = await rpc.getAccountInfo(address("SysvarC1ock11111111111111111111111111111111"), {
    commitment: "confirmed", encoding: "base64",
  }).send().catch(() => { throw new ProofError("chain_unavailable", 503); });
  if (!value || value.owner !== "Sysvar1111111111111111111111111111111111111" || value.executable) {
    throw new ProofError("chain_unavailable", 503);
  }
  const data = Buffer.from(value.data[0], "base64");
  if (data.length !== 40) throw new ProofError("chain_unavailable", 503);
  const clock = new Date(Number(data.readBigInt64LE(32)) * 1000);
  if (!Number.isFinite(clock.getTime())) throw new ProofError("chain_unavailable", 503);
  return clock;
}

export async function readClaim(rpc: Rpc<GetAccountInfoApi>, bounty: string) {
  const { value } = await rpc.getAccountInfo(await claimAddress(address(bounty)), {
    commitment: "confirmed", encoding: "base64",
  }).send();
  if (!value) return null;
  const data = Buffer.from(value.data[0], "base64");
  if (value.owner !== ESCROW_PROGRAM_ID || data.length !== 89
    || !data.subarray(0, 8).equals(Buffer.from([61, 34, 187, 8, 123, 74, 77, 244]))) {
    throw new ProofError("chain_mismatch");
  }
  const decoder = getAddressDecoder();
  if (decoder.decode(data.subarray(8, 40)) !== bounty) throw new ProofError("chain_mismatch");
  return {
    scout: decoder.decode(data.subarray(40, 72)),
    acceptedAt: new Date(Number(data.readBigInt64LE(72)) * 1000),
    expiresAt: new Date(Number(data.readBigInt64LE(80)) * 1000),
  };
}
