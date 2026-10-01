import { address } from "@solana/kit";

import { getDb } from "../../lib/db.js";
import { bearerToken, getSessionWallet } from "../../lib/session.js";
import { createMainnetRpc } from "../../lib/sgt.js";
import { resolveTier } from "../../lib/tier.js";

export async function GET(request: Request) {
  const token = bearerToken(request);
  const db = getDb();
  const walletAddress = token ? await getSessionWallet(db, token) : null;
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const tier = await resolveTier(db, createMainnetRpc(), address(walletAddress));
    return Response.json(tier, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("SGT tier check failed", error);
    return Response.json({ error: "tier_check_unavailable" }, { status: 503 });
  }
}
