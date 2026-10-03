import { createHash } from "node:crypto";
import { accountRequest } from "../lib/account.js";
import { ProofError } from "../lib/proof-error.js";
import { getDb } from "../lib/db.js";
import { getProfile, setUsername } from "../lib/profile.js";
import { bearerToken, getSessionWallet } from "../lib/session.js";
import { maintainPush } from "../lib/push-maintenance.js";

const noStore = { "Cache-Control": "no-store" };

async function authenticate(request: Request) {
  const token = bearerToken(request);
  const db = getDb();
  const walletAddress = token ? await getSessionWallet(db, token) : null;
  return { db, walletAddress };
}

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("action") === "push-maintenance") return maintainPush(request);
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (new URL(request.url).searchParams.has("action")) return handleAccount(request);
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

async function handleAccount(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    return Response.json(
      await accountRequest(
        db,
        walletAddress,
        request.method,
        new URL(request.url).searchParams.get("action") ?? "",
        request.method === "GET" ? null : await request.json().catch(() => null),
        createHash("sha256").update(bearerToken(request)!).digest("hex"),
      ),
      { headers: noStore },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof ProofError ? e.code : "service_unavailable" },
      { status: e instanceof ProofError ? e.status : 503, headers: noStore },
    );
  }
}
export const POST = handleAccount;
export const DELETE = handleAccount;
