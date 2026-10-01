import { getDb } from "../lib/db.js";
import { getProfile, setUsername } from "../lib/profile.js";
import { bearerToken, getSessionWallet } from "../lib/session.js";

const noStore = { "Cache-Control": "no-store" };

async function authenticate(request: Request) {
  const token = bearerToken(request);
  const db = getDb();
  const walletAddress = token ? await getSessionWallet(db, token) : null;
  return { db, walletAddress };
}

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json(await getProfile(db, walletAddress), { headers: noStore });
}

export async function PUT(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const username = body && typeof body === "object" ? (body as { username?: unknown }).username : undefined;
  const status = await setUsername(db, walletAddress, username);
  if (status === "invalid") return Response.json({ error: "invalid_username" }, { status: 400 });
  if (status === "taken") return Response.json({ error: "username_taken" }, { status: 409 });
  return Response.json(await getProfile(db, walletAddress), { headers: noStore });
}
