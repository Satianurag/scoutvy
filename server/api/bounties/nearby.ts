import { authenticate } from "../../lib/auth.js";
import { listNearby, listRemote, parsePoint } from "../../lib/bounties.js";

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  if (params.get("mode") === "remote") {
    const bounties = await listRemote(db, walletAddress);
    return Response.json({ bounties }, { headers: { "Cache-Control": "no-store" } });
  }
  const from = parsePoint(params.get("lat"), params.get("lng"));
  if (!from) return Response.json({ error: "invalid_location" }, { status: 400 });
  const bounties = await listNearby(db, walletAddress, from);
  return Response.json({ bounties }, { headers: { "Cache-Control": "no-store" } });
}
