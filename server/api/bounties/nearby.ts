import { authenticate } from "../../lib/auth.js";
import { listNearby, parsePoint } from "../../lib/bounties.js";

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const from = parsePoint(params.get("lat"), params.get("lng"));
  if (!from) return Response.json({ error: "invalid_location" }, { status: 400 });
  const bounties = await listNearby(db, walletAddress, from);
  return Response.json({ bounties }, { headers: { "Cache-Control": "no-store" } });
}
