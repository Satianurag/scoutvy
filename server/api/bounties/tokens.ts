import { address, createSolanaRpc } from "@solana/kit";

import { authenticate } from "../../lib/auth.js";
import { SOLANA_DEVNET_RPC_URL } from "../../lib/config.js";
import { getBountyTokens } from "../../lib/escrow.js";

export async function GET(request: Request) {
  const { walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const tokens = await getBountyTokens(createSolanaRpc(SOLANA_DEVNET_RPC_URL), address(walletAddress));
    return Response.json({ tokens }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Bounty token balance lookup failed", error);
    return Response.json({ error: "chain_unavailable" }, { status: 503 });
  }
}
