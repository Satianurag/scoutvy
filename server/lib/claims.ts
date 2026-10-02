import { address, getAddressDecoder, type GetAccountInfoApi, type Rpc } from "@solana/kit";

import { claimAddress } from "../../src/post/escrow.js";
import { ESCROW_PROGRAM_ID } from "./escrow.js";
import { ProofError } from "./proof-error.js";

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
