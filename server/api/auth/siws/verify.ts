import { getDb } from "../../../lib/db.js";
import { createSession } from "../../../lib/session.js";
import { verifySignInResult } from "../../../lib/siws.js";

export async function POST(request: Request) {
  let body: { nonce?: unknown; signInResult?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const db = getDb();
  const walletAddress = await verifySignInResult(db, body.nonce, body.signInResult);
  if (!walletAddress) {
    return Response.json({ error: "invalid_sign_in" }, { status: 401 });
  }
  const session = await createSession(db, walletAddress);
  return Response.json({ walletAddress, ...session }, { headers: { "Cache-Control": "no-store" } });
}
