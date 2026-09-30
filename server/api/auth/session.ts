import { getDb } from "../../lib/db.js";
import { bearerToken, deleteSession, getSessionWallet } from "../../lib/session.js";

export async function GET(request: Request) {
  const token = bearerToken(request);
  const walletAddress = token ? await getSessionWallet(getDb(), token) : null;
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ walletAddress }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const token = bearerToken(request);
  if (token) await deleteSession(getDb(), token);
  return new Response(null, { status: 204 });
}
