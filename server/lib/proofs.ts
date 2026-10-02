import { createHash, randomUUID } from "node:crypto";

import { address, type GetAccountInfoApi, type Rpc } from "@solana/kit";
import sharp from "sharp";

import { distanceM, type Point } from "./bounties.js";
import type { Db } from "./db.js";
import { bountyAddress, checkCurrentEscrow } from "./escrow.js";
import { readClaim } from "./claims.js";
import { ProofError } from "./proof-error.js";

export { ProofError } from "./proof-error.js";

export const MAX_IMAGE_BYTES = 1_048_576;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLAIM_MINUTES = 60;
const CAPTURE_MINUTES = 5;

type Target = {
  id: string;
  poster_wallet: string;
  status: string;
  expires_at: Date | string;
  latitude: number;
  longitude: number;
  radius_m: number;
  mint: string;
  amount: string;
};

type ClaimRow = {
  scout_wallet: string;
  confirmed_at: Date | string | null;
  expires_at: Date | string;
  capture_token: string | null;
  capture_started_at: Date | string | null;
  capture_expires_at: Date | string | null;
};

type ProofRow = { id: string; scout_wallet: string; received_at: Date | string; source_sha256: string };
export type ProofReceipt = { id: string; status: "pending_review"; receivedAt: string };
export type ScoutState =
  | { status: "available" | "taken" | "unavailable" }
  | { status: "reserved"; bountyAddress: string; expiresAt: string }
  | { status: "accepted"; expiresAt: string; target: Point; radiusM: number }
  | { status: "submitted"; proof: ProofReceipt };
export type CaptureTicket = { token: string; startedAt: string; expiresAt: string };
export type ProofMetadata = {
  token: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  locationAt: string;
  capturedAt: string;
  mocked: boolean;
};


const iso = (value: Date | string) => new Date(value).toISOString();
const receipt = (row: ProofRow): ProofReceipt => ({ id: row.id, status: "pending_review", receivedAt: iso(row.received_at) });
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

async function target(db: Db, id: string): Promise<Target> {
  if (!UUID.test(id)) throw new ProofError("not_found", 404);
  const [row] = await db.query<Target>("SELECT * FROM bounties WHERE id = $1", [id]);
  if (!row) throw new ProofError("not_found", 404);
  return row;
}

function requireOpen(row: Target) {
  if (row.status !== "open" || new Date(row.expires_at).getTime() <= Date.now()) throw new ProofError("bounty_unavailable");
}

async function requireFunded(rpc: Rpc<GetAccountInfoApi>, row: Target) {
  const check = await checkCurrentEscrow(rpc, {
    id: row.id,
    poster: address(row.poster_wallet),
    mint: address(row.mint),
    amount: BigInt(row.amount),
    expiresAt: BigInt(Math.floor(new Date(row.expires_at).getTime() / 1000)),
  }).catch(() => { throw new ProofError("chain_unavailable", 503); });
  if (check !== "funded") throw new ProofError("bounty_unavailable");
}

export async function getScoutState(db: Db, scout: string, id: string): Promise<ScoutState> {
  const row = await target(db, id);
  const [proof] = await db.query<ProofRow>(
    "SELECT id, scout_wallet, received_at, source_sha256 FROM bounty_proofs WHERE bounty_id = $1", [id],
  );
  if (proof?.scout_wallet === scout) return { status: "submitted", proof: receipt(proof) };
  if (row.poster_wallet === scout || row.status !== "open" || new Date(row.expires_at).getTime() <= Date.now()) {
    return { status: "unavailable" };
  }
  if (proof) return { status: "taken" };
  const [claim] = await db.query<ClaimRow>(
    `SELECT * FROM scout_claims WHERE bounty_id = $1 AND expires_at > now()
       AND (confirmed_at IS NOT NULL OR accepted_at > now() - interval '2 minutes')`, [id],
  );
  if (!claim) return { status: "available" };
  if (claim.scout_wallet !== scout) return { status: "taken" };
  if (!claim.confirmed_at) return {
    status: "reserved", expiresAt: iso(claim.expires_at),
    bountyAddress: await bountyAddress(address(row.poster_wallet), id),
  };
  return {
    status: "accepted", expiresAt: iso(claim.expires_at),
    target: { latitude: Number(row.latitude), longitude: Number(row.longitude) }, radiusM: row.radius_m,
  };
}

export async function acceptBounty(db: Db, rpc: Rpc<GetAccountInfoApi>, scout: string, id: string): Promise<ScoutState> {
  const row = await target(db, id);
  requireOpen(row);
  if (row.poster_wallet === scout) throw new ProofError("own_bounty");
  await requireFunded(rpc, row);
  const pda = await bountyAddress(address(row.poster_wallet), id);
  const chain = await readClaim(rpc, pda);
  const active = chain && chain.expiresAt.getTime() > Date.now();
  if (active && chain.scout !== scout) throw new ProofError("bounty_taken");
  const [claim] = await db.query<ClaimRow>(
    `INSERT INTO scout_claims (bounty_id, scout_wallet, expires_at)
     SELECT id, $2, COALESCE($3::timestamptz, date_trunc('second', LEAST(expires_at, now() + interval '${CLAIM_MINUTES} minutes'))) FROM bounties
     WHERE id = $1 AND status = 'open' AND expires_at > now()
       AND NOT EXISTS (SELECT 1 FROM bounty_proofs WHERE bounty_id = $1)
     ON CONFLICT (bounty_id) DO UPDATE SET scout_wallet = EXCLUDED.scout_wallet,
       accepted_at = now(), expires_at = EXCLUDED.expires_at,
       capture_token = NULL, capture_started_at = NULL, capture_expires_at = NULL, confirmed_at = NULL
     WHERE (scout_claims.expires_at <= now()
       OR ($3::timestamptz IS NOT NULL AND (scout_claims.scout_wallet <> $2 OR scout_claims.expires_at <> $3::timestamptz))
       OR (scout_claims.confirmed_at IS NULL AND scout_claims.accepted_at <= now() - interval '2 minutes'))
       AND NOT EXISTS (SELECT 1 FROM bounty_proofs WHERE bounty_id = $1)
     RETURNING *`,
    [id, scout, active ? chain.expiresAt.toISOString() : null],
  );
  const state = await getScoutState(db, scout, id);
  if (!claim && state.status !== "accepted" && state.status !== "submitted" && state.status !== "reserved") throw new ProofError("bounty_taken");
  if (active && (state.status === "reserved" || state.status === "accepted")) return confirmClaim(db, rpc, scout, id);
  return state;
}

export async function confirmClaim(db: Db, rpc: Rpc<GetAccountInfoApi>, scout: string, id: string): Promise<ScoutState> {
  const row = await target(db, id);
  requireOpen(row);
  const chain = await readClaim(rpc, await bountyAddress(address(row.poster_wallet), id));
  if (!chain || chain.expiresAt.getTime() <= Date.now()) throw new ProofError("unconfirmed", 503);
  if (chain.scout !== scout) throw new ProofError("bounty_taken");
  const [claim] = await db.query<ClaimRow>(
    `UPDATE scout_claims SET confirmed_at = $3, accepted_at = $3
     WHERE bounty_id = $1 AND scout_wallet = $2 AND expires_at = $4::timestamptz RETURNING *`,
    [id, scout, chain.acceptedAt.toISOString(), chain.expiresAt.toISOString()],
  );
  if (!claim) throw new ProofError("chain_mismatch");
  return getScoutState(db, scout, id);
}

export async function prepareCapture(db: Db, scout: string, id: string): Promise<CaptureTicket> {
  const row = await target(db, id);
  requireOpen(row);
  const [claim] = await db.query<ClaimRow>(
    `UPDATE scout_claims SET capture_token = $3, capture_started_at = now(),
       capture_expires_at = LEAST(expires_at, now() + interval '${CAPTURE_MINUTES} minutes')
     WHERE bounty_id = $1 AND scout_wallet = $2 AND expires_at > now() AND confirmed_at IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM bounty_proofs WHERE bounty_id = $1)
     RETURNING *`,
    [id, scout, randomUUID()],
  );
  if (!claim?.capture_token || !claim.capture_started_at || !claim.capture_expires_at) throw new ProofError("claim_expired");
  return { token: claim.capture_token, startedAt: iso(claim.capture_started_at), expiresAt: iso(claim.capture_expires_at) };
}

export async function releaseClaim(db: Db, rpc: Rpc<GetAccountInfoApi>, scout: string, id: string) {
  if (!UUID.test(id)) throw new ProofError("not_found", 404);
  const row = await target(db, id);
  const [claim] = await db.query<ClaimRow>("SELECT * FROM scout_claims WHERE bounty_id = $1 AND scout_wallet = $2", [id, scout]);
  if (!claim) return { released: true, bountyAddress: null };
  const [proof] = await db.query<ProofRow>("SELECT id FROM bounty_proofs WHERE bounty_id = $1", [id]);
  if (proof) throw new ProofError("proof_already_submitted");
  const pda = await bountyAddress(address(row.poster_wallet), id);
  const chain = await readClaim(rpc, pda);
  if (chain?.scout === scout && chain.expiresAt.getTime() > Date.now()) return { released: false, bountyAddress: pda };
  await db.query(
    `DELETE FROM scout_claims WHERE bounty_id = $1 AND scout_wallet = $2
     AND NOT EXISTS (SELECT 1 FROM bounty_proofs WHERE bounty_id = $1)`,
    [id, scout],
  ).catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "23503") throw new ProofError("proof_already_submitted");
    throw error;
  });
  return { released: true, bountyAddress: null };
}

export function parseProofMetadata(value: unknown): ProofMetadata {
  if (!value || typeof value !== "object") throw new ProofError("invalid_metadata", 400);
  const m = value as Record<string, unknown>;
  const numeric = [m.latitude, m.longitude, m.accuracyM];
  if (numeric.some((n) => typeof n !== "number" || !Number.isFinite(n))
    || Math.abs(m.latitude as number) > 90 || Math.abs(m.longitude as number) > 180
    || (m.accuracyM as number) <= 0 || (m.accuracyM as number) > 50
    || typeof m.token !== "string" || !UUID.test(m.token)
    || typeof m.mocked !== "boolean"
    || typeof m.capturedAt !== "string" || !Number.isFinite(Date.parse(m.capturedAt))
    || typeof m.locationAt !== "string" || !Number.isFinite(Date.parse(m.locationAt))) {
    throw new ProofError("invalid_metadata", 400);
  }
  return m as ProofMetadata;
}

export async function readProofImage(request: Request): Promise<Buffer> {
  if (request.headers.get("content-type") !== "image/jpeg") throw new ProofError("invalid_image", 415);
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new ProofError("image_too_large", 413);
  if (!request.body) throw new ProofError("invalid_image", 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw new ProofError("image_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function submitProof(
  db: Db, rpc: Rpc<GetAccountInfoApi>, scout: string, id: string, metadata: ProofMetadata, bytes: Buffer,
): Promise<ProofReceipt> {
  metadata = parseProofMetadata(metadata);
  const row = await target(db, id);
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new ProofError("invalid_image", 400);
  const sourceHash = hash(bytes);
  const [existing] = await db.query<ProofRow>(
    "SELECT id, scout_wallet, received_at, source_sha256 FROM bounty_proofs WHERE bounty_id = $1", [id],
  );
  if (existing) {
    if (existing.scout_wallet === scout && existing.source_sha256 === sourceHash) return receipt(existing);
    throw new ProofError("proof_already_submitted");
  }
  requireOpen(row);
  const [claim] = await db.query<ClaimRow>("SELECT * FROM scout_claims WHERE bounty_id = $1 AND scout_wallet = $2", [id, scout]);
  const now = Date.now();
  if (!claim?.confirmed_at || new Date(claim.expires_at).getTime() <= now) throw new ProofError("claim_expired");
  const chain = await readClaim(rpc, await bountyAddress(address(row.poster_wallet), id));
  if (!chain || chain.scout !== scout || chain.expiresAt.getTime() !== new Date(claim.expires_at).getTime()) {
    throw new ProofError("chain_mismatch");
  }
  if (claim.capture_token !== metadata.token || !claim.capture_started_at || !claim.capture_expires_at
    || new Date(claim.capture_expires_at).getTime() <= now) throw new ProofError("capture_expired");
  const capturedAt = Date.parse(metadata.capturedAt);
  const locationAt = Date.parse(metadata.locationAt);
  const startedAt = new Date(claim.capture_started_at).getTime();
  if (capturedAt < startedAt - 5000 || capturedAt > now + 5000 || now - capturedAt > CAPTURE_MINUTES * 60_000
    || Math.abs(locationAt - capturedAt) > 30_000) throw new ProofError("stale_capture", 422);
  if (metadata.mocked) throw new ProofError("mock_location", 422);
  if (distanceM(metadata, { latitude: Number(row.latitude), longitude: Number(row.longitude) }) + metadata.accuracyM > row.radius_m) {
    throw new ProofError("outside_radius", 422);
  }
  let image: Buffer;
  let width: number;
  let height: number;
  try {
    const input = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
    const info = await input.metadata();
    if (info.format !== "jpeg") throw new Error("not jpeg");
    const result = await input.rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
    image = result.data;
    width = result.info.width;
    height = result.info.height;
  } catch {
    throw new ProofError("invalid_image", 400);
  }
  if (image.length > MAX_IMAGE_BYTES) throw new ProofError("image_too_large", 413);
  await requireFunded(rpc, row);
  const [saved] = await db.query<ProofRow>(
    `WITH owned AS (
       SELECT c.* FROM scout_claims c JOIN bounties b ON b.id = c.bounty_id
       WHERE c.bounty_id = $1 AND c.scout_wallet = $2 AND c.expires_at > now() AND c.confirmed_at IS NOT NULL
         AND c.capture_token = $3 AND c.capture_expires_at > now()
         AND b.status = 'open' AND b.expires_at > now() FOR UPDATE OF c, b
     )
     INSERT INTO bounty_proofs
       (id, bounty_id, scout_wallet, image, source_sha256, image_sha256, width, height,
        reported_latitude, reported_longitude, reported_accuracy_m, reported_location_at,
        reported_capture_at, capture_started_at)
     SELECT $4, bounty_id, scout_wallet, decode($5, 'hex'), $6, $7, $8, $9, $10, $11, $12, $13, $14, capture_started_at
     FROM owned ON CONFLICT (bounty_id) DO NOTHING RETURNING id, scout_wallet, received_at, source_sha256`,
    [id, scout, metadata.token, randomUUID(), image.toString("hex"), sourceHash, hash(image), width, height,
      metadata.latitude, metadata.longitude, metadata.accuracyM, metadata.locationAt, metadata.capturedAt],
  );
  if (saved) return receipt(saved);
  const [current] = await db.query<ProofRow>(
    "SELECT id, scout_wallet, received_at, source_sha256 FROM bounty_proofs WHERE bounty_id = $1", [id],
  );
  if (current?.scout_wallet === scout && current.source_sha256 === sourceHash) return receipt(current);
  throw new ProofError("claim_expired");
}
