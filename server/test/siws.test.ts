import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { getAddressDecoder } from "@solana/kit";
import { createSignInMessage } from "@solana/wallet-standard-util";

import type { Db } from "../lib/db.js";
import { createSession, deleteSession, getSessionWallet } from "../lib/session.js";
import { issueSignInPayload, verifySignInResult, type SignInPayload } from "../lib/siws.js";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

async function createTestDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(schema);
  return {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
  };
}

function createWallet() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const jwk = publicKey.export({ format: "jwk" });
  const publicKeyBytes = new Uint8Array(Buffer.from(jwk.x!, "base64url"));
  return { privateKey, publicKeyBytes, address: getAddressDecoder().decode(publicKeyBytes) };
}

function walletSign(
  wallet: { privateKey: KeyObject; publicKeyBytes: Uint8Array; address: string },
  payload: SignInPayload,
  overrides: Partial<SignInPayload> & { address?: string } = {},
) {
  const message = createSignInMessage({ ...payload, address: wallet.address, ...overrides });
  const signature = sign(null, message, wallet.privateKey);
  return {
    address: Buffer.from(wallet.publicKeyBytes).toString("base64"),
    signature: signature.toString("base64"),
    signed_message: Buffer.from(message).toString("base64"),
  };
}

describe("SIWS", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("accepts a valid sign-in and derives the wallet from the signature", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db);
    assert.equal(await verifySignInResult(db, payload.nonce, walletSign(wallet, payload)), wallet.address);
  });

  it("rejects replaying the same signed result", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db);
    const result = walletSign(wallet, payload);
    assert.equal(await verifySignInResult(db, payload.nonce, result), wallet.address);
    assert.equal(await verifySignInResult(db, payload.nonce, result), null);
  });

  it("rejects an unknown nonce", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db);
    assert.equal(await verifySignInResult(db, "deadbeef", walletSign(wallet, { ...payload, nonce: "deadbeef" })), null);
  });

  it("rejects an expired nonce", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db, new Date(Date.now() - 11 * 60 * 1000));
    assert.equal(await verifySignInResult(db, payload.nonce, walletSign(wallet, payload)), null);
  });

  it("rejects a message signed for another domain", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db);
    const result = walletSign(wallet, payload, { domain: "evil.example" });
    assert.equal(await verifySignInResult(db, payload.nonce, result), null);
  });

  it("rejects a signature from a different key", async () => {
    const wallet = createWallet();
    const attacker = createWallet();
    const payload = await issueSignInPayload(db);
    const result = { ...walletSign(attacker, payload, { address: wallet.address }), address: walletSign(wallet, payload).address };
    assert.equal(await verifySignInResult(db, payload.nonce, result), null);
  });

  it("rejects a message naming a different address than the signer", async () => {
    const wallet = createWallet();
    const other = createWallet();
    const payload = await issueSignInPayload(db);
    assert.equal(await verifySignInResult(db, payload.nonce, walletSign(wallet, payload, { address: other.address })), null);
  });

  it("rejects malformed input without consuming the nonce", async () => {
    const wallet = createWallet();
    const payload = await issueSignInPayload(db);
    assert.equal(await verifySignInResult(db, payload.nonce, { address: "x" }), null);
    assert.equal(await verifySignInResult(db, payload.nonce, walletSign(wallet, payload)), wallet.address);
  });
});

describe("sessions", () => {
  it("creates, resolves and deletes a session", async () => {
    const db = await createTestDb();
    const { address } = createWallet();
    const { token } = await createSession(db, address);
    assert.equal(await getSessionWallet(db, token), address);
    assert.equal(await getSessionWallet(db, "not-a-token"), null);
    await deleteSession(db, token);
    assert.equal(await getSessionWallet(db, token), null);
  });
});
