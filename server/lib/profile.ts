import type { Db } from "./db.js";

export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;

export type Profile = { walletAddress: string; username: string | null };

export type UsernameStatus = "available" | "taken" | "invalid";

export async function getProfile(db: Db, walletAddress: string): Promise<Profile> {
  const rows = await db.query<{ username: string | null }>(
    "SELECT username FROM users WHERE wallet_address = $1",
    [walletAddress],
  );
  return { walletAddress, username: rows[0]?.username ?? null };
}

export async function usernameStatus(
  db: Db,
  username: unknown,
  walletAddress?: string,
): Promise<UsernameStatus> {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) return "invalid";
  const rows = await db.query<{ wallet_address: string }>(
    "SELECT wallet_address FROM users WHERE lower(username) = lower($1)",
    [username],
  );
  const owner = rows[0]?.wallet_address;
  return owner && owner !== walletAddress ? "taken" : "available";
}

export async function setUsername(
  db: Db,
  walletAddress: string,
  username: unknown,
): Promise<UsernameStatus> {
  if (typeof username !== "string" || !USERNAME_PATTERN.test(username)) return "invalid";
  try {
    const rows = await db.query(
      "UPDATE users SET username = $2 WHERE wallet_address = $1 RETURNING wallet_address",
      [walletAddress, username],
    );
    return rows.length ? "available" : "invalid";
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") return "taken";
    throw error;
  }
}
