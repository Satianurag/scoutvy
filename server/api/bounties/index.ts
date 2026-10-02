import { authenticate, readJson } from "../../lib/auth.js";
import { createBounty, getBounty, parseBountyInput, parsePoint } from "../../lib/bounties.js";

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const bounty = await getBounty(db, walletAddress, params.get("id") ?? "", parsePoint(params.get("lat"), params.get("lng")));
  if (!bounty) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ bounty }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(request);
  if (body === undefined) return Response.json({ error: "invalid_json" }, { status: 400 });
  const parsed = parseBountyInput(body);
  if ("invalid" in parsed) return Response.json({ error: `invalid_${parsed.invalid}` }, { status: 400 });
  const bounty = await createBounty(db, walletAddress, parsed.input);
  return Response.json({ bounty }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
