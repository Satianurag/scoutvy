import type { Address } from "@solana/kit";

import type { Db } from "./db.js";
import { findSgtMints, type SgtRpc } from "./sgt.js";

export type Tier =
  | { tier: "verified_seeker"; sgtMint: Address }
  | { tier: "unverified"; reason: "no_sgt" | "sgt_claimed_by_another_wallet" };

/**
 * Each SGT mint is bound to the first wallet that claims it. SGTs can move between Seed Vault
 * accounts without changing mint, so a mint already bound to another wallet does not verify.
 */
export async function resolveTier(db: Db, rpc: SgtRpc, walletAddress: Address): Promise<Tier> {
  const mints = await findSgtMints(rpc, walletAddress);
  for (const mint of mints) {
    const rows = await db.query<{ wallet_address: string }>(
      `INSERT INTO sgt_claims (mint, wallet_address) VALUES ($1, $2)
       ON CONFLICT (mint) DO UPDATE SET last_verified_at = now()
       WHERE sgt_claims.wallet_address = EXCLUDED.wallet_address
       RETURNING wallet_address`,
      [mint, walletAddress],
    );
    if (rows.length > 0) return { tier: "verified_seeker", sgtMint: mint };
  }
  return { tier: "unverified", reason: mints.length > 0 ? "sgt_claimed_by_another_wallet" : "no_sgt" };
}
