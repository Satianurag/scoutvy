import { authenticate, readJson } from "../../lib/auth.js";
import { createBounty, parseBountyInput } from "../../lib/bounties.js";

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
