import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, describe, it } from "node:test";

import { PGlite } from "@electric-sql/pglite";
import { address, createSolanaRpcFromTransport, getAddressEncoder, getI64Encoder, getU64Encoder } from "@solana/kit";
import sharp from "sharp";

import { claimAddress } from "../../src/post/escrow.js";
import { activity } from "../lib/activity.js";
import { createBounty, getBounty, parseBountyInput } from "../lib/bounties.js";
import type { Db } from "../lib/db.js";
import { BOUNTY_TOKENS, ESCROW_PROGRAM_ID, TOKEN_PROGRAM_ID, bountyAddress, uuidBytes } from "../lib/escrow.js";
import {
  acceptBounty, confirmClaim, getScoutState, MAX_IMAGE_BYTES, parseProofMetadata, prepareCapture,
  ProofError, readProofImage, releaseClaim, submitProof, type CaptureTicket, type ProofMetadata,
} from "../lib/proofs.js";

const POSTER = "9huc6N3DK3epXD8UPWidRsJ1c7Rd4n6vLJzbLgQEuKgo";
const SCOUT = "D5hSBMTAbviXumeWV2StkgQQ9wxkZagWnG8Vh3VzJfcV";
const OTHER = "11111111111111111111111111111111";
const POINT = { latitude: 28.6315, longitude: 77.2167 };
const pg = new PGlite();
const db: Db = {
  async query<T>(text: string, params: unknown[] = []) {
    return (await pg.query<T>(text, params)).rows;
  },
};
let jpeg: Buffer;

before(async () => {
  await pg.exec(await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"));
  jpeg = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: "#AB9FF3" } }).jpeg().toBuffer();
});
after(() => pg.close());
beforeEach(async () => {
  await pg.exec("TRUNCATE users CASCADE");
  await db.query("INSERT INTO users (wallet_address) VALUES ($1), ($2), ($3)", [POSTER, SCOUT, OTHER]);
});

async function fixture() {
  const parsed = parseBountyInput({
    ...POINT, title: "Check opening hours", instructions: "Take a clear photo of the opening hours on the door.",
    locationLabel: "Connaught Place", radiusM: 100, mint: BOUNTY_TOKENS[0].mint, amount: "1000000", durationHours: 24,
  });
  assert.ok("input" in parsed);
  const bounty = await createBounty(db, POSTER, parsed.input);
  await db.query("UPDATE bounties SET status = 'open' WHERE id = $1", [bounty.id]);
  const a = getAddressEncoder();
  const data = Buffer.from([
    237, 16, 105, 198, 19, 69, 242, 234, ...a.encode(address(POSTER)), ...a.encode(address(bounty.mint)),
    ...uuidBytes(bounty.id), ...getU64Encoder().encode(BigInt(bounty.amount)), ...getI64Encoder().encode(1n),
    ...getI64Encoder().encode(BigInt(Date.parse(bounty.expiresAt) / 1000)), 255,
  ]);
  const pda = await bountyAddress(address(POSTER), bounty.id);
  const claimPda = await claimAddress(pda);
  let claimData: Buffer | null = null;
  let funded = true;
  let clockTime: bigint | null = BigInt(Math.floor(Date.now() / 1000));
  let clockOwner = "Sysvar1111111111111111111111111111111111111";
  let clockLength = 40;
  const setClaim = (scout: string, expiresAt: string) => {
    claimData = Buffer.from([
      ...createHash("sha256").update("account:ScoutClaim").digest().subarray(0, 8),
      ...a.encode(pda), ...a.encode(address(scout)),
      ...getI64Encoder().encode(BigInt(Math.floor(Date.now() / 1000))),
      ...getI64Encoder().encode(BigInt(Math.floor(Date.parse(expiresAt) / 1000))), 255,
    ]);
  };
  const rpc = createSolanaRpcFromTransport(async ({ payload }) => {
    const { id, method, params } = payload as { id: number; method: string; params: [string] };
    assert.equal(method, "getAccountInfo");
    const clock = Buffer.alloc(40);
    if (clockTime !== null) clock.writeBigInt64LE(clockTime, 32);
    const value = params[0] === "SysvarC1ock11111111111111111111111111111111"
      ? clockTime !== null ? { data: [clock.subarray(0, clockLength).toString("base64"), "base64"], owner: clockOwner } : null
      : params[0] === claimPda
      ? claimData ? { data: [claimData.toString("base64"), "base64"], owner: ESCROW_PROGRAM_ID } : null
      : params[0] === pda
      ? funded ? { data: [data.toString("base64"), "base64"], owner: ESCROW_PROGRAM_ID } : null
      : { data: { parsed: { info: { mint: bounty.mint, owner: pda, tokenAmount: { amount: bounty.amount } } } }, owner: TOKEN_PROGRAM_ID };
    return { jsonrpc: "2.0", id, result: { context: { slot: 1 }, value: value ? { ...value, executable: false, lamports: 1, rentEpoch: 0, space: 0 } : null } } as never;
  });
  const accept = async (scout = SCOUT) => {
    const reservation = await acceptBounty(db, rpc, scout, bounty.id);
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("Expected reservation");
    setClaim(scout, reservation.expiresAt);
    return confirmClaim(db, rpc, scout, bounty.id);
  };
  return {
    bounty, rpc, accept, setClaim, setFunded: (value: boolean) => { funded = value; },
    setClock: (time: bigint | null, owner = clockOwner, length = 40) => { clockTime = time; clockOwner = owner; clockLength = length; },
  };
}

const metadata = (capture: CaptureTicket): ProofMetadata => ({
  ...POINT, token: capture.token, accuracyM: 5, mocked: false, capturedAt: capture.startedAt, locationAt: capture.startedAt,
});
const rejects = (work: Promise<unknown>, code: string) => assert.rejects(work, (error: unknown) => error instanceof ProofError && error.code === code);

describe("scout claims", () => {
  it("bounds reservations by the chain clock when the server is ahead or behind", async () => {
    for (const drift of [-300n, 300n]) {
      const { bounty, rpc, setClock, setClaim } = await fixture();
      const clock = BigInt(Math.floor(Date.now() / 1000)) + drift;
      setClock(clock);
      const reservation = await acceptBounty(db, rpc, SCOUT, bounty.id);
      assert.equal(reservation.status, "reserved");
      if (reservation.status !== "reserved") throw new Error("Expected reservation");
      const expiry = BigInt(Date.parse(reservation.expiresAt) / 1000);
      assert.ok(expiry <= clock + 3570n);
      assert.ok(expiry <= BigInt(Math.floor(Date.now() / 1000)) + 3600n);
      assert.ok(expiry <= BigInt(Date.parse(bounty.expiresAt) / 1000));
      if (drift < 0) assert.equal(expiry, clock + 3570n);
      setClaim(SCOUT, reservation.expiresAt);
      assert.equal((await confirmClaim(db, rpc, SCOUT, bounty.id)).status, "accepted");
    }
  });

  it("repairs an unsigned reservation outside the chain bound without releasing another scout's reservation", async () => {
    const { bounty, rpc, setClock } = await fixture();
    const reservation = await acceptBounty(db, rpc, SCOUT, bounty.id);
    assert.equal(reservation.status, "reserved");
    const clock = BigInt(Math.floor(Date.now() / 1000)) - 120n;
    setClock(clock);
    await rejects(acceptBounty(db, rpc, OTHER, bounty.id), "bounty_taken");
    const repaired = await acceptBounty(db, rpc, SCOUT, bounty.id);
    assert.equal(repaired.status, "reserved");
    if (repaired.status !== "reserved") throw new Error("Expected reservation");
    assert.equal(BigInt(Date.parse(repaired.expiresAt) / 1000), clock + 3570n);
    assert.deepEqual(await acceptBounty(db, rpc, SCOUT, bounty.id), repaired);
  });

  it("refuses reservations when the Clock account is missing, malformed or has the wrong owner", async () => {
    const { bounty, rpc, setClock } = await fixture();
    const clock = BigInt(Math.floor(Date.now() / 1000));
    setClock(null);
    await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "chain_unavailable");
    setClock(clock, OTHER);
    await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "chain_unavailable");
    setClock(clock, "Sysvar1111111111111111111111111111111111111", 39);
    await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "chain_unavailable");
    setClock(9_223_372_036_854_775_807n);
    await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "chain_unavailable");
    assert.deepEqual(await getScoutState(db, SCOUT, bounty.id), { status: "available" });
  });

  it("reveals the exact target only to the scout after acceptance", async () => {
    const { bounty, rpc, accept } = await fixture();
    assert.deepEqual(await getScoutState(db, SCOUT, bounty.id), { status: "available" });
    const view = await getBounty(db, SCOUT, bounty.id, POINT);
    assert.ok(view && !("latitude" in view) && !("posterWallet" in view) && view.bountyAddress === null);
    const accepted = await accept();
    assert.ok(accepted.status === "accepted");
    assert.deepEqual(accepted.target, POINT);
    assert.ok(Date.parse(accepted.expiresAt) <= Date.now() + 60 * 60_000);
    assert.deepEqual(await getScoutState(db, OTHER, bounty.id), { status: "taken" });
    assert.deepEqual(await acceptBounty(db, rpc, SCOUT, bounty.id), accepted);
  });

  it("lets exactly one concurrent scout claim, then permits an expired claim takeover", async () => {
    const { bounty, rpc } = await fixture();
    const results = await Promise.allSettled([acceptBounty(db, rpc, SCOUT, bounty.id), acceptBounty(db, rpc, OTHER, bounty.id)]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const [claim] = await db.query<{ scout_wallet: string }>("SELECT scout_wallet FROM scout_claims");
    await rejects(prepareCapture(db, claim.scout_wallet === SCOUT ? OTHER : SCOUT, bounty.id), "claim_expired");
    await db.query("UPDATE scout_claims SET expires_at = now() - interval '1 second'");
    assert.equal((await acceptBounty(db, rpc, OTHER, bounty.id)).status, "reserved");
  });

  it("does not reveal the target, allow capture or emit Activity until the wallet claim confirms", async () => {
    const { bounty, rpc, setClaim } = await fixture();
    const reservation = await acceptBounty(db, rpc, SCOUT, bounty.id);
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("Expected reservation");
    assert.ok(!("target" in reservation));
    await rejects(confirmClaim(db, rpc, SCOUT, bounty.id), "unconfirmed");
    await rejects(prepareCapture(db, SCOUT, bounty.id), "claim_expired");
    assert.deepEqual((await activity(db, SCOUT)).events, []);
    setClaim(OTHER, reservation.expiresAt);
    await rejects(confirmClaim(db, rpc, SCOUT, bounty.id), "bounty_taken");
    setClaim(SCOUT, new Date(Date.now() - 1000).toISOString());
    await rejects(confirmClaim(db, rpc, SCOUT, bounty.id), "unconfirmed");
    setClaim(SCOUT, new Date(Date.parse(reservation.expiresAt) - 1000).toISOString());
    await rejects(confirmClaim(db, rpc, SCOUT, bounty.id), "chain_mismatch");
    setClaim(SCOUT, reservation.expiresAt);
    assert.equal((await confirmClaim(db, rpc, SCOUT, bounty.id)).status, "accepted");
    assert.equal((await activity(db, SCOUT)).events[0].kind, "accepted");
  });

  it("restores an interrupted wallet confirmation and respects chain ownership after database expiry", async () => {
    const { bounty, rpc, setClaim } = await fixture();
    const reservation = await acceptBounty(db, rpc, SCOUT, bounty.id);
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("Expected reservation");
    setClaim(SCOUT, reservation.expiresAt);
    assert.equal((await acceptBounty(db, rpc, SCOUT, bounty.id)).status, "accepted");
    await db.query("UPDATE scout_claims SET expires_at = now() - interval '1 second'");
    await rejects(acceptBounty(db, rpc, OTHER, bounty.id), "bounty_taken");
    assert.equal((await acceptBounty(db, rpc, SCOUT, bounty.id)).status, "accepted");
    setClaim(SCOUT, new Date(0).toISOString());
    await db.query("UPDATE scout_claims SET expires_at = now() - interval '1 second'");
    assert.equal((await acceptBounty(db, rpc, OTHER, bounty.id)).status, "reserved");
  });

  it("expires unsigned reservations and restores the wallet that actually owns the on-chain claim", async () => {
    const { bounty, rpc, setClaim } = await fixture();
    const reservation = await acceptBounty(db, rpc, SCOUT, bounty.id);
    assert.equal(reservation.status, "reserved");
    if (reservation.status !== "reserved") throw new Error("Expected reservation");
    await db.query("UPDATE scout_claims SET accepted_at = now() - interval '3 minutes'");
    assert.equal((await getScoutState(db, OTHER, bounty.id)).status, "available");
    assert.equal((await acceptBounty(db, rpc, OTHER, bounty.id)).status, "reserved");
    setClaim(SCOUT, reservation.expiresAt);
    assert.equal((await acceptBounty(db, rpc, SCOUT, bounty.id)).status, "accepted");
    await rejects(acceptBounty(db, rpc, OTHER, bounty.id), "bounty_taken");
  });

  it("rejects the poster, expired/cancelled/draft bounties and missing funding", async () => {
    const { bounty, rpc } = await fixture();
    await rejects(acceptBounty(db, rpc, POSTER, bounty.id), "own_bounty");
    const unfunded = createSolanaRpcFromTransport(async () => ({ jsonrpc: "2.0", id: 1, result: { context: { slot: 1 }, value: null } }) as never);
    await rejects(acceptBounty(db, unfunded, SCOUT, bounty.id), "bounty_unavailable");
    for (const status of ["cancelled", "pending", "expired"]) {
      await db.query("UPDATE bounties SET status = $2 WHERE id = $1", [bounty.id, status]);
      await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "bounty_unavailable");
    }
    await db.query("UPDATE bounties SET status = 'open', expires_at = now() - interval '1 second'");
    await rejects(acceptBounty(db, rpc, SCOUT, bounty.id), "bounty_unavailable");
  });

  it("allows only the owner to release or replace a capture ticket", async () => {
    const { bounty, rpc, accept, setClaim } = await fixture();
    await accept();
    const first = await prepareCapture(db, SCOUT, bounty.id);
    await acceptBounty(db, rpc, SCOUT, bounty.id);
    const [restored] = await db.query<{ capture_token: string }>("SELECT capture_token FROM scout_claims");
    assert.equal(restored.capture_token, first.token);
    const second = await prepareCapture(db, SCOUT, bounty.id);
    assert.notEqual(first.token, second.token);
    assert.ok(Date.parse(second.expiresAt) <= Date.now() + 5 * 60_000);
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, metadata(first), jpeg), "capture_expired");
    await releaseClaim(db, rpc, OTHER, bounty.id);
    assert.equal((await getScoutState(db, SCOUT, bounty.id)).status, "accepted");
    assert.equal((await releaseClaim(db, rpc, SCOUT, bounty.id)).released, false);
    setClaim(SCOUT, new Date(0).toISOString());
    await releaseClaim(db, rpc, SCOUT, bounty.id);
    assert.deepEqual(await getScoutState(db, OTHER, bounty.id), { status: "available" });
  });
});

describe("proof evidence", () => {
  it("normalizes and persists pending-review evidence, with deterministic concurrent retries", async () => {
    const { bounty, rpc, accept } = await fixture();
    await accept();
    const capture = await prepareCapture(db, SCOUT, bounty.id);
    const results = await Promise.all([
      submitProof(db, rpc, SCOUT, bounty.id, metadata(capture), jpeg),
      submitProof(db, rpc, SCOUT, bounty.id, metadata(capture), jpeg),
    ]);
    assert.deepEqual(results[0], results[1]);
    assert.equal(results[0].status, "pending_review");
    const [proof] = await db.query<{
      image: Uint8Array; image_sha256: string; source_sha256: string; width: number; height: number; scout_wallet: string;
    }>("SELECT * FROM bounty_proofs");
    assert.equal(proof.scout_wallet, SCOUT);
    assert.equal(proof.width, 1600);
    assert.ok(proof.height <= 1600 && proof.image.length <= MAX_IMAGE_BYTES);
    assert.equal(proof.image_sha256, createHash("sha256").update(proof.image).digest("hex"));
    assert.equal(proof.source_sha256, createHash("sha256").update(jpeg).digest("hex"));
    await rejects(releaseClaim(db, rpc, SCOUT, bounty.id), "proof_already_submitted");
    assert.deepEqual(await getScoutState(db, SCOUT, bounty.id), { status: "submitted", proof: results[0] });
    assert.deepEqual(await getScoutState(db, OTHER, bounty.id), { status: "taken" });
    await rejects(submitProof(db, rpc, OTHER, bounty.id, metadata(capture), jpeg), "proof_already_submitted");
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, metadata(capture), Buffer.concat([jpeg, Buffer.from("different")])), "proof_already_submitted");
  });

  it("rejects stale, future, mocked, inaccurate and outside-radius metadata", async () => {
    const { bounty, rpc, accept } = await fixture();
    await accept();
    const capture = await prepareCapture(db, SCOUT, bounty.id);
    const valid = metadata(capture);
    const cases: [Partial<ProofMetadata>, string][] = [
      [{ mocked: true }, "mock_location"],
      [{ accuracyM: 51 }, "invalid_metadata"],
      [{ latitude: POINT.latitude + 0.01 }, "outside_radius"],
      [{ capturedAt: new Date(Date.now() - 6 * 60_000).toISOString() }, "stale_capture"],
      [{ capturedAt: new Date(Date.now() + 60_000).toISOString() }, "stale_capture"],
      [{ locationAt: new Date(Date.now() - 60_000).toISOString() }, "stale_capture"],
    ];
    for (const [overrides, code] of cases) {
      await rejects(submitProof(db, rpc, SCOUT, bounty.id, { ...valid, ...overrides }, jpeg), code);
    }
    await db.query("UPDATE scout_claims SET capture_expires_at = now() - interval '1 second'");
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, jpeg), "capture_expired");
    await db.query("UPDATE scout_claims SET expires_at = now() - interval '1 second'");
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, jpeg), "claim_expired");
  });

  it("rejects forged image types, corrupted JPEGs and excessive input dimensions", async () => {
    const { bounty, rpc, accept } = await fixture();
    await accept();
    const valid = metadata(await prepareCapture(db, SCOUT, bounty.id));
    for (const image of [Buffer.from("not a photo"), jpeg.subarray(0, 100), await sharp(jpeg).png().toBuffer()]) {
      await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, image), "invalid_image");
    }
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "#111111" } }).jpeg().toBuffer();
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, huge), "invalid_image");
  });

  it("rechecks escrow and bounty state before storing proof", async () => {
    const { bounty, rpc, accept, setFunded } = await fixture();
    await accept();
    const valid = metadata(await prepareCapture(db, SCOUT, bounty.id));
    setFunded(false);
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, jpeg), "bounty_unavailable");
    await db.query("UPDATE bounties SET status = 'cancelled'");
    await rejects(submitProof(db, rpc, SCOUT, bounty.id, valid, jpeg), "bounty_unavailable");
    assert.deepEqual(await db.query("SELECT id FROM bounty_proofs"), []);
  });
});

describe("proof request boundaries", () => {
  it("bounds streamed uploads without relying on content-length", async () => {
    const request = (bytes: Uint8Array, type = "image/jpeg") => new Request("https://scoutvy.vercel.app/api/bounties", {
      method: "POST", headers: { "content-type": type }, body: new Uint8Array(bytes),
    });
    assert.deepEqual(await readProofImage(request(jpeg)), jpeg);
    await rejects(readProofImage(request(jpeg, "image/png")), "invalid_image");
    await rejects(readProofImage(request(Buffer.alloc(MAX_IMAGE_BYTES + 1))), "image_too_large");
    await rejects(readProofImage(new Request("https://scoutvy.vercel.app/api/bounties", { method: "POST", headers: { "content-type": "image/jpeg" } })), "invalid_image");
  });

  it("rejects malformed metadata and coordinates", () => {
    const valid = metadata({ token: "00000000-0000-0000-0000-000000000000", startedAt: new Date().toISOString(), expiresAt: new Date().toISOString() });
    for (const value of [null, {}, { ...valid, token: "nope" }, { ...valid, latitude: NaN }, { ...valid, longitude: 181 },
      { ...valid, accuracyM: 0 }, { ...valid, mocked: "false" }, { ...valid, locationAt: "not a date" }]) {
      assert.throws(() => parseProofMetadata(value), (error: unknown) => error instanceof ProofError && error.code === "invalid_metadata");
    }
  });
});
