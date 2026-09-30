import { randomBytes } from "node:crypto";

import { getAddressDecoder } from "@solana/kit";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import { parseSignInMessage, verifySignIn } from "@solana/wallet-standard-util";

import { APP_DOMAIN, APP_URI, NONCE_TTL_MS, SIWS_STATEMENT } from "./config.js";
import type { Db } from "./db.js";

export type SignInPayload = Required<
  Pick<SolanaSignInInput, "domain" | "statement" | "uri" | "version" | "nonce" | "issuedAt" | "expirationTime">
>;

export type MwaSignInResult = {
  address: string;
  signature: string;
  signed_message: string;
};

export async function issueSignInPayload(db: Db, now = new Date()): Promise<SignInPayload> {
  const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);
  const payload: SignInPayload = {
    domain: APP_DOMAIN,
    statement: SIWS_STATEMENT,
    uri: APP_URI,
    version: "1",
    nonce: randomBytes(16).toString("hex"),
    issuedAt: now.toISOString(),
    expirationTime: expiresAt.toISOString(),
  };
  await db.query("DELETE FROM siws_nonces WHERE expires_at < now()");
  await db.query("INSERT INTO siws_nonces (nonce, payload, expires_at) VALUES ($1, $2, $3)", [
    payload.nonce,
    JSON.stringify(payload),
    expiresAt.toISOString(),
  ]);
  return payload;
}

async function consumeSignInPayload(db: Db, nonce: string): Promise<SignInPayload | null> {
  const rows = await db.query<{ payload: SignInPayload | string; valid: boolean }>(
    "DELETE FROM siws_nonces WHERE nonce = $1 RETURNING payload, expires_at > now() AS valid",
    [nonce],
  );
  const row = rows[0];
  if (!row || !row.valid) return null;
  return typeof row.payload === "string" ? (JSON.parse(row.payload) as SignInPayload) : row.payload;
}

function isMwaSignInResult(value: unknown): value is MwaSignInResult {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.address === "string" && typeof v.signature === "string" && typeof v.signed_message === "string";
}

export async function verifySignInResult(db: Db, nonce: unknown, signInResult: unknown): Promise<string | null> {
  if (typeof nonce !== "string" || !isMwaSignInResult(signInResult)) return null;

  const payload = await consumeSignInPayload(db, nonce);
  if (!payload || payload.domain !== APP_DOMAIN) return null;

  const publicKey = new Uint8Array(Buffer.from(signInResult.address, "base64"));
  if (publicKey.length !== 32) return null;
  const walletAddress = getAddressDecoder().decode(publicKey);
  const signedMessage = new Uint8Array(Buffer.from(signInResult.signed_message, "base64"));
  const signature = new Uint8Array(Buffer.from(signInResult.signature, "base64"));

  if (parseSignInMessage(signedMessage)?.address !== walletAddress) return null;

  const valid = verifySignIn(payload, {
    account: { address: walletAddress, publicKey, chains: [], features: [] },
    signature,
    signedMessage,
  });
  return valid ? walletAddress : null;
}
