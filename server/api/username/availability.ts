import { getDb } from "../../lib/db.js";
import { usernameStatus } from "../../lib/profile.js";
import { bearerToken, getSessionWallet } from "../../lib/session.js";

export async function GET(request: Request) {
  const token = bearerToken(request);
  const db = getDb();
  const walletAddress = token ? await getSessionWallet(db, token) : null;
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const username = new URL(request.url).searchParams.get("username");
  const status = await usernameStatus(db, username, walletAddress);
  return Response.json({ status }, { headers: { "Cache-Control": "no-store" } });
}
