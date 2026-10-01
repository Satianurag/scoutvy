import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";

import type { Db } from "../lib/db.js";
import { getProfile, setUsername, usernameStatus } from "../lib/profile.js";

const schema = await readFile(new URL("../db/schema.sql", import.meta.url), "utf8");

const ALICE = "9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo";
const BOB = "D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV";

let db: Db;

beforeEach(async () => {
  const pg = new PGlite();
  await pg.exec(schema);
  db = {
    async query<T>(text: string, params: unknown[] = []) {
      return (await pg.query<T>(text, params)).rows;
    },
  };
  await db.query("INSERT INTO users (wallet_address) VALUES ($1), ($2)", [ALICE, BOB]);
});

describe("profile", () => {
  it("starts without a username", async () => {
    assert.deepEqual(await getProfile(db, ALICE), { walletAddress: ALICE, username: null });
  });

  it("sets and returns a username", async () => {
    assert.equal(await setUsername(db, ALICE, "Swift_Scout42"), "available");
    assert.equal((await getProfile(db, ALICE)).username, "Swift_Scout42");
  });

  it("rejects invalid usernames", async () => {
    for (const bad of ["ab", "a".repeat(21), "has space", "emoji😀", "", null, 42, undefined]) {
      assert.equal(await setUsername(db, ALICE, bad), "invalid", String(bad));
      assert.equal(await usernameStatus(db, bad), "invalid", String(bad));
    }
  });

  it("treats usernames case-insensitively for uniqueness", async () => {
    await setUsername(db, ALICE, "ScoutKing");
    assert.equal(await usernameStatus(db, "scoutking", BOB), "taken");
    assert.equal(await setUsername(db, BOB, "SCOUTKING"), "taken");
    assert.equal((await getProfile(db, BOB)).username, null);
  });

  it("reports your own username as available to you", async () => {
    await setUsername(db, ALICE, "ScoutKing");
    assert.equal(await usernameStatus(db, "scoutking", ALICE), "available");
    assert.equal(await setUsername(db, ALICE, "scoutKING"), "available");
  });

  it("lets a user rename and frees the old name", async () => {
    await setUsername(db, ALICE, "First");
    await setUsername(db, ALICE, "Second");
    assert.equal(await usernameStatus(db, "First", BOB), "available");
  });

  it("does not create users for unknown wallets", async () => {
    assert.equal(await setUsername(db, "Unknown1111111111111111111111111111111111", "Ghost"), "invalid");
  });
});
