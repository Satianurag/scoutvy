import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { getAddressDecoder, getBase64Decoder } from "@solana/kit";
import { createSignInMessage } from "@solana/wallet-standard-util";
import { stringToUint8Array } from "@wallet-ui/core";

import { toMwaSignInResult } from "../../src/auth/mwa-sign-in-result.js";
import type { Db } from "../lib/db.js";
import { issueSignInPayload, verifySignInResult } from "../lib/siws.js";

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

async function walletSignIn(db: Db) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyBytes = new Uint8Array(Buffer.from(publicKey.export({ format: "jwk" }).x!, "base64url"));
  const address = getAddressDecoder().decode(publicKeyBytes);
  const payload = await issueSignInPayload(db);
  const message = createSignInMessage({ ...payload, address });
  const mwaResult = {
    address: Buffer.from(publicKeyBytes).toString("base64"),
    signature: sign(null, message, privateKey).toString("base64"),
    signed_message: Buffer.from(message).toString("base64"),
  };
  // Same conversion as @wallet-ui/react-native-kit convertSignInResult.
  const output = {
    account: { addressBase64: mwaResult.address },
    signature: stringToUint8Array(mwaResult.signature),
    signedMessage: stringToUint8Array(mwaResult.signed_message),
  };
  return { address, payload, mwaResult, output };
}

describe("MWA sign-in result from @wallet-ui/react-native-kit", () => {
  let db: Db;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it("round-trips to the original MWA result and verifies", async () => {
    const { address, payload, mwaResult, output } = await walletSignIn(db);
    assert.deepEqual(toMwaSignInResult(output), mwaResult);
    assert.equal(await verifySignInResult(db, payload.nonce, toMwaSignInResult(output)), address);
  });

  it("rejects the result when the output bytes are base64-encoded again", async () => {
    const { payload, output } = await walletSignIn(db);
    const base64 = getBase64Decoder();
    const doubleEncoded = {
      address: output.account.addressBase64,
      signature: base64.decode(output.signature),
      signed_message: base64.decode(output.signedMessage),
    };
    assert.equal(await verifySignInResult(db, payload.nonce, doubleEncoded), null);
  });
});
