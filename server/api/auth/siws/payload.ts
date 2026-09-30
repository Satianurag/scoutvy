import { getDb } from "../../../lib/db.js";
import { issueSignInPayload } from "../../../lib/siws.js";

export async function POST() {
  const payload = await issueSignInPayload(getDb());
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
