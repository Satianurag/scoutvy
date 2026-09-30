import {
  address,
  createSolanaRpc,
  type Address,
  type GetMultipleAccountsApi,
  type GetTokenAccountsByOwnerApi,
  type Rpc,
} from "@solana/kit";

import { SOLANA_MAINNET_RPC_URL } from "./config.js";

// https://docs.solanamobile.com/marketing/engaging-seeker-users#key-addresses
export const TOKEN_2022_PROGRAM_ADDRESS = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const SGT_MINT_AUTHORITY = address("GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4");
export const SGT_METADATA_ADDRESS = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");
export const SGT_GROUP_ADDRESS = address("GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te");

const MAX_ACCOUNTS_PER_REQUEST = 100;

export type SgtRpc = Rpc<GetTokenAccountsByOwnerApi & GetMultipleAccountsApi>;

export function createMainnetRpc(): SgtRpc {
  return createSolanaRpc(SOLANA_MAINNET_RPC_URL);
}

type Json = Record<string, unknown>;

function isObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null;
}

function parsedInfo(data: unknown, type: string): Json | null {
  if (!isObject(data) || !isObject(data.parsed)) return null;
  if (data.parsed.type !== type || !isObject(data.parsed.info)) return null;
  return data.parsed.info;
}

function extensionState(info: Json, name: string): Json | null {
  if (!Array.isArray(info.extensions)) return null;
  const extension: unknown = info.extensions.find((e: unknown) => isObject(e) && e.extension === name);
  return isObject(extension) && isObject(extension.state) ? extension.state : null;
}

export function isSgtMintInfo(info: Json): boolean {
  const metadataPointer = extensionState(info, "metadataPointer");
  const groupMember = extensionState(info, "tokenGroupMember");
  return (
    info.mintAuthority === SGT_MINT_AUTHORITY &&
    metadataPointer?.authority === SGT_MINT_AUTHORITY &&
    metadataPointer.metadataAddress === SGT_METADATA_ADDRESS &&
    groupMember?.group === SGT_GROUP_ADDRESS
  );
}

/** Mints of verified Seeker Genesis Tokens that `owner` currently holds a non-zero balance of. */
export async function findSgtMints(rpc: SgtRpc, owner: Address): Promise<Address[]> {
  const { value: tokenAccounts } = await rpc
    .getTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ADDRESS }, { encoding: "jsonParsed" })
    .send();

  const heldMints = new Set<Address>();
  for (const { account } of tokenAccounts) {
    if (account.owner !== TOKEN_2022_PROGRAM_ADDRESS) continue;
    const info = parsedInfo(account.data, "account");
    const amount = isObject(info?.tokenAmount) ? info.tokenAmount.amount : undefined;
    if (info?.owner === owner && typeof info.mint === "string" && typeof amount === "string" && amount !== "0") {
      heldMints.add(address(info.mint));
    }
  }

  const mints = [...heldMints];
  const sgtMints: Address[] = [];
  for (let i = 0; i < mints.length; i += MAX_ACCOUNTS_PER_REQUEST) {
    const batch = mints.slice(i, i + MAX_ACCOUNTS_PER_REQUEST);
    const { value: mintAccounts } = await rpc.getMultipleAccounts(batch, { encoding: "jsonParsed" }).send();
    mintAccounts.forEach((mintAccount, j) => {
      if (mintAccount?.owner !== TOKEN_2022_PROGRAM_ADDRESS) return;
      const info = parsedInfo(mintAccount.data, "mint");
      if (info && isSgtMintInfo(info)) sgtMints.push(batch[j]);
    });
  }
  return sgtMints;
}
