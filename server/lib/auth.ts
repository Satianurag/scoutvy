import { getDb } from "./db.js";
import { bearerToken, getSessionWallet } from "./session.js";

export async function authenticate(request: Request) {
  const token = bearerToken(request);
  const db = getDb();
  const walletAddress = token ? await getSessionWallet(db, token) : null;
  return { db, walletAddress };
}

export async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
