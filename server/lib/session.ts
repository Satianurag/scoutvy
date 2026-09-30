import { createHash, randomBytes } from "node:crypto";

import { SESSION_TTL_MS } from "./config.js";
import type { Db } from "./db.js";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(db: Db, walletAddress: string, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.query(
    `INSERT INTO users (wallet_address) VALUES ($1)
     ON CONFLICT (wallet_address) DO UPDATE SET last_sign_in_at = now()`,
    [walletAddress],
  );
  await db.query("INSERT INTO sessions (token_hash, wallet_address, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    walletAddress,
    expiresAt.toISOString(),
  ]);
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getSessionWallet(db: Db, token: string): Promise<string | null> {
  const rows = await db.query<{ wallet_address: string }>(
    "SELECT wallet_address FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [hashToken(token)],
  );
  return rows[0]?.wallet_address ?? null;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header?.match(/^Bearer (.+)$/);
  return match ? match[1] : null;
}
