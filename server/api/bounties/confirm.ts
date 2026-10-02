import { authenticate, readJson } from "../../lib/auth.js";
import { confirmBounty } from "../../lib/bounties.js";
import { createDevnetRpc } from "../../lib/rpc.js";

const STATUS_CODES = {
  not_found: 404,
  invalid_signature: 400,
  conflict: 409,
  unconfirmed: 409,
  failed: 422,
  mismatch: 422,
} as const;

export async function POST(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (typeof body !== "object" || body === null) return Response.json({ error: "invalid_json" }, { status: 400 });
  const { id, signature } = body as { id?: unknown; signature?: unknown };
  try {
    const result = await confirmBounty(db, createDevnetRpc(), walletAddress, id, signature);
    if (result.status === "open") return Response.json({ bounty: result.bounty }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: result.status }, { status: STATUS_CODES[result.status] });
  } catch (error) {
    console.error("Bounty confirmation failed", error);
    return Response.json({ error: "chain_unavailable" }, { status: 503 });
  }
}
