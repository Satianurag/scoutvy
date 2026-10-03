import { safeNotify } from "../../lib/notifications.js";
import { authenticate, readJson } from "../../lib/auth.js";
import { confirmBounty, recoverBounty } from "../../lib/bounties.js";
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
  if (typeof body !== "object" || body === null)
    return Response.json({ error: "invalid_json" }, { status: 400 });
  const { id, signature, recover } = body as { id?: unknown; signature?: unknown; recover?: unknown };
  try {
    if (recover === true) {
      const result = await recoverBounty(db, createDevnetRpc(), walletAddress, id);
      if (result.status === "recovered") {
        if (result.bounty.status === "open") await safeNotify(db, result.bounty.id);
        return Response.json({ bounty: result.bounty }, { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json({ error: result.status }, { status: STATUS_CODES[result.status] });
    }
    const result = await confirmBounty(db, createDevnetRpc(), walletAddress, id, signature);
    if (result.status === "open") await safeNotify(db, result.bounty.id);
    if (result.status === "open")
      return Response.json({ bounty: result.bounty }, { headers: { "Cache-Control": "no-store" } });
    return Response.json({ error: result.status }, { status: STATUS_CODES[result.status] });
  } catch (error) {
    console.error("bounty_confirmation_failed", { name: error instanceof Error ? error.name : "Unknown" });
    return Response.json({ error: "chain_unavailable" }, { status: 503 });
  }
}
