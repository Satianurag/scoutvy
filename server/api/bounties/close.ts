import { authenticate, readJson } from "../../lib/auth.js";
import { closeBounty } from "../../lib/bounties.js";
import { createDevnetRpc } from "../../lib/rpc.js";

const STATUS_CODES = { not_found: 404, not_open: 409, still_open: 409, unconfirmed: 409 } as const;

export async function POST(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (typeof body !== "object" || body === null) return Response.json({ error: "invalid_json" }, { status: 400 });
  try {
    const result = await closeBounty(db, createDevnetRpc(), walletAddress, (body as { id?: unknown }).id);
    if (result.status === "closed") return Response.json({ bounty: result.bounty }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: result.status }, { status: STATUS_CODES[result.status] });
  } catch (error) {
    console.error("Bounty close check failed", error);
    return Response.json({ error: "chain_unavailable" }, { status: 503 });
  }
}
