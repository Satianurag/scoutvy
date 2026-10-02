import { authenticate } from "../../lib/auth.js";
import { getBounty, parsePoint } from "../../lib/bounties.js";

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const bounty = await getBounty(db, walletAddress, params.get("id") ?? "", parsePoint(params.get("lat"), params.get("lng")));
  if (!bounty) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ bounty }, { headers: { "Cache-Control": "no-store" } });
}
