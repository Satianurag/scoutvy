import { address } from "@solana/kit";

import { getDb } from "../lib/db.js";
import { bearerToken, getSessionWallet } from "../lib/session.js";
import { createWalletRpc, getWalletTokens } from "../lib/wallet.js";

export async function GET(request: Request) {
  const token = bearerToken(request);
  const walletAddress = token ? await getSessionWallet(getDb(), token) : null;
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const tokens = await getWalletTokens(createWalletRpc(), address(walletAddress));
    return Response.json({ tokens }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Wallet balance lookup failed", error);
    return Response.json({ error: "wallet_unavailable" }, { status: 503 });
  }
}
