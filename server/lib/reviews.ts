import { address, createSolanaRpc, getBase58Encoder } from "@solana/kit";

import { closeBounty, type BountyStatus } from "./bounties.js";
import type { Db } from "./db.js";
import { BOUNTY_TOKENS } from "./escrow.js";
import { ProofError } from "./proofs.js";
import { attest, decisionDigest, expectedBounty, readReview, releaseUnreviewed, resolverAddress, reviewSignature, type ExpectedReview } from "./settlement.js";

type Rpc = ReturnType<typeof createSolanaRpc>;
export type ReviewRow = {
  id: string; bounty_id: string; poster_wallet: string; scout_wallet: string; title: string; instructions: string;
  mint: string; amount: string; image_sha256: string | null; width: number | null; height: number | null; received_at: string | Date;
  proof_type?: "photo" | "written"; written_text?: string | null; evidence_sha256?: string | null;
  status: "pending_review" | "disputed" | "paid" | "refunded"; review_deadline: string | Date | null;
  decision_reason: string | null; decision_digest: string | null; resolution_reason: string | null; resolution_digest: string | null;
  attestation_signature: string | null; dispute_signature: string | null; settlement_signature: string | null;
  reviewed_at: string | Date | null; settled_at: string | Date | null; last_error: string | null;
  wallet_signature: string | null; wallet_action: string | null;
  bounty_status: BountyStatus;
};

export async function reviewRow(db: Db, viewer: string, id: string, resolver?: string): Promise<ReviewRow> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ProofError("not_found", 404);
  const [row] = await db.query<ReviewRow>(
    `SELECT p.*, b.poster_wallet, b.title, b.instructions, b.mint, b.amount, b.status AS bounty_status
     FROM bounty_proofs p JOIN bounties b ON b.id = p.bounty_id
     WHERE b.id = $1 AND (b.poster_wallet = $2 OR p.scout_wallet = $2 OR $2 = $3)`,
    [id, viewer, resolver ?? null],
  );
  if (!row) throw new ProofError("not_found", 404);
  return row;
}

export async function expectedReview(row: ReviewRow): Promise<ExpectedReview> {
  const digest = row.evidence_sha256 ?? row.image_sha256;
  if (!digest) throw new ProofError("chain_mismatch");
  return { bounty: await expectedBounty(row.poster_wallet, row.bounty_id), poster: address(row.poster_wallet),
    scout: address(row.scout_wallet), mint: address(row.mint), amount: BigInt(row.amount), proof: digest };
}

export async function reconcileReview(db: Db, rpc: Rpc, row: ReviewRow, viewer: string, resolver: string, protect = false): Promise<ReviewRow> {
  if (row.bounty_status === "cancelled" || row.bounty_status === "expired") {
    if (protect) throw new ProofError("bounty_unavailable");
    return row;
  }
  const expected = await expectedReview(row);
  if (protect) {
    try { await attest(rpc, expected); }
    catch (error) {
      const closed = await closeBounty(db, rpc, row.poster_wallet, row.bounty_id).catch(() => null);
      if (closed?.status === "closed") throw new ProofError("bounty_unavailable");
      throw error;
    }
  }
  const chain = await readReview(rpc, expected);
  if (!chain) {
    if (row.attestation_signature || row.status !== "pending_review") throw new ProofError("chain_mismatch");
    return row;
  }
  if ((row.status === "paid" || row.status === "refunded") && row.status !== chain.status) throw new ProofError("chain_mismatch");
  const attestation = row.attestation_signature ?? await reviewSignature(rpc, expected, "attest");
  const disputed = chain.dispute !== "0".repeat(64);
  if (disputed && (!row.decision_digest || row.decision_digest !== chain.dispute)) throw new ProofError("decision_not_recorded");
  if (chain.resolution !== "0".repeat(64) && row.resolution_digest !== chain.resolution) throw new ProofError("decision_not_recorded");
  const disputeSignature = disputed ? row.dispute_signature ?? await reviewSignature(rpc, expected, "dispute") : null;
  const terminal = chain.status === "paid" || chain.status === "refunded";
  const settlement = chain.status === "paid" || chain.status === "refunded"
    ? row.settlement_signature ?? await reviewSignature(rpc, expected, chain.status) : null;
  await db.query(
    `WITH updated AS (
       UPDATE bounty_proofs SET status = $2, attestation_signature = $3, review_deadline = $4,
         dispute_signature = COALESCE(dispute_signature, $5), reviewed_at = CASE WHEN $5::text IS NOT NULL THEN COALESCE(reviewed_at, now()) ELSE reviewed_at END,
         reviewer_wallet = CASE WHEN $5::text IS NOT NULL THEN $8 ELSE reviewer_wallet END,
         settlement_signature = COALESCE(settlement_signature, $6), settled_at = CASE WHEN $6::text IS NOT NULL THEN $7::timestamptz ELSE settled_at END,
         decision_action = CASE WHEN status <> $2 THEN NULL ELSE decision_action END,
         last_error = NULL
       WHERE bounty_id = $1 AND (status = 'pending_review' OR status = $2 OR (status = 'disputed' AND $2 IN ('paid', 'refunded')))
       RETURNING bounty_id
     )
     UPDATE bounties SET status = $2 WHERE id IN (SELECT bounty_id FROM updated) AND $2 IN ('paid', 'refunded')`,
    [row.bounty_id, chain.status, attestation, chain.deadline.toISOString(), disputeSignature, settlement,
      terminal ? chain.decidedAt.toISOString() : null, row.poster_wallet],
  );
  return reviewRow(db, viewer, row.bounty_id, resolver);
}

const iso = (date: Date | string | null) => date ? new Date(date).toISOString() : null;
export function reviewView(row: ReviewRow, viewer: string, resolver: string) {
  const token = BOUNTY_TOKENS.find((t) => t.mint === row.mint);
  if (!token) throw new ProofError("chain_mismatch");
  return {
    id: row.bounty_id, proofId: row.id, title: row.title, instructions: row.instructions,
    proofType: row.proof_type ?? "photo", writtenText: row.written_text ?? null,
    role: viewer === row.poster_wallet ? "poster" : viewer === row.scout_wallet ? "scout" : viewer === resolver ? "resolver" : "none",
    status: row.bounty_status === "cancelled" || row.bounty_status === "expired" ? row.bounty_status : row.status,
    mint: row.mint, symbol: token.symbol, amount: String(row.amount), decimals: token.decimals,
    width: row.width, height: row.height, receivedAt: iso(row.received_at), deadline: iso(row.review_deadline),
    protected: row.attestation_signature !== null, disputeReason: row.dispute_signature ? row.decision_reason : null,
    resolutionReason: row.settlement_signature ? row.resolution_reason : null,
    signature: viewer === row.poster_wallet || viewer === row.scout_wallet || viewer === resolver ? row.settlement_signature : null,
    settledAt: iso(row.settled_at), retryable: row.last_error !== null,
    preparedReason: viewer === row.poster_wallet && row.status === "pending_review" ? row.decision_reason
      : viewer === resolver && row.status === "disputed" ? row.resolution_reason : null,
    preparedPayScout: viewer === resolver && row.resolution_reason
      ? row.resolution_digest === decisionDigest(`scout:${row.resolution_reason}`) : null,
  };
}

export async function getReview(db: Db, rpc: Rpc, viewer: string, id: string) {
  const resolver = await resolverAddress(rpc);
  let row = await reviewRow(db, viewer, id, resolver);
  row = await reconcileReview(db, rpc, row, viewer, resolver);
  return reviewView(row, viewer, resolver);
}

export async function protectedImage(db: Db, viewer: string, id: string, resolver?: string) {
  const row = await reviewRow(db, viewer, id, resolver);
  if (row.proof_type === "written") throw new ProofError("not_found", 404);
  const [image] = await db.query<{ image: Uint8Array }>("SELECT image FROM bounty_proofs WHERE id = $1", [row.id]);
  return Buffer.from(image.image);
}

export function parseReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 10 || value.trim().length > 500) throw new ProofError("invalid_reason", 400);
  return value.trim();
}

export async function prepareDecision(
  db: Db, rpc: Rpc, viewer: string, id: string, action: "approve" | "dispute" | "resolve", body: unknown,
) {
  const resolver = await resolverAddress(rpc);
  let row = await reviewRow(db, viewer, id, resolver);
  if (action === "resolve" ? viewer !== resolver : viewer !== row.poster_wallet) throw new ProofError("forbidden", 403);
  row = await reconcileReview(db, rpc, row, viewer, resolver, true);
  if (row.status === "paid" || row.status === "refunded") return { review: reviewView(row, viewer, resolver), transaction: null };
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  let reason: string | null = null;
  let payScout = true;
  if (action === "dispute" || action === "resolve") reason = parseReason(input.reason);
  if (action === "resolve") {
    if (typeof input.payScout !== "boolean") throw new ProofError("invalid_resolution", 400);
    payScout = input.payScout;
    if (row.status !== "disputed") throw new ProofError("invalid_state");
  } else if (row.status === "disputed") {
    if (action === "dispute" && row.decision_reason === reason) return { review: reviewView(row, viewer, resolver), transaction: null };
    throw new ProofError("invalid_state");
  }
  if (action === "dispute" && (!row.review_deadline || new Date(row.review_deadline).getTime() <= Date.now())) throw new ProofError("review_ended");
  const [reserved] = await db.query(
    `UPDATE bounty_proofs SET decision_action = $2, decision_prepared_at = now()
     WHERE bounty_id = $1 AND status = $3
       AND (decision_action IS NULL OR decision_action = $2 OR decision_prepared_at < now() - interval '2 minutes')
     RETURNING id`,
    [id, action, row.status],
  );
  if (!reserved) throw new ProofError("decision_conflict");
  if (reason) {
    const resolution = action === "resolve";
    const digest = decisionDigest(resolution ? `${payScout ? "scout" : "poster"}:${reason}` : reason);
    const column = resolution ? "resolution" : "decision";
    const [saved] = await db.query(
      `UPDATE bounty_proofs SET ${column}_reason = $2, ${column}_digest = $3
       WHERE bounty_id = $1 AND status = $4 AND (${column}_digest IS NULL OR ${column}_digest = $3) RETURNING id`,
      [id, reason, digest, row.status],
    );
    if (!saved) throw new ProofError("decision_conflict");
    row = await reviewRow(db, viewer, id, resolver);
  }
  const expected = await expectedReview(row);
  return {
    review: reviewView(row, viewer, resolver),
    transaction: { action, bounty: expected.bounty, poster: row.poster_wallet, mint: row.mint,
      recipient: payScout ? row.scout_wallet : row.poster_wallet,
      digest: action === "resolve" ? row.resolution_digest : row.decision_digest, payScout },
  };
}

export async function refreshSettlement(db: Db, rpc: Rpc, viewer: string, id: string, release = false) {
  const resolver = await resolverAddress(rpc);
  let row = await reviewRow(db, viewer, id, resolver);
  try {
    row = await reconcileReview(db, rpc, row, viewer, resolver, row.status === "pending_review" || row.status === "disputed");
    if (release && row.status === "pending_review") {
      await releaseUnreviewed(rpc, await expectedReview(row));
      row = await reconcileReview(db, rpc, row, viewer, resolver);
    }
    return reviewView(row, viewer, resolver);
  } catch (error) {
    await db.query("UPDATE bounty_proofs SET last_error = $2, attempted_at = now(), attempt_count = attempt_count + 1 WHERE bounty_id = $1 AND status IN ('pending_review', 'disputed') AND EXISTS (SELECT 1 FROM bounties WHERE id = $1 AND status = 'open')",
      [id, error instanceof ProofError ? error.code : "service_unavailable"]);
    throw error;
  }
}

export async function recordDecision(db: Db, rpc: Rpc, viewer: string, id: string, body: unknown) {
  const resolver = await resolverAddress(rpc);
  const row = await reviewRow(db, viewer, id, resolver);
  const input = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  if (input.action !== "approve" && input.action !== "dispute" && input.action !== "resolve") throw new ProofError("invalid_action", 400);
  if (input.action === "resolve" ? viewer !== resolver : viewer !== row.poster_wallet) throw new ProofError("forbidden", 403);
  if (typeof input.signature !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(input.signature)
    || getBase58Encoder().encode(input.signature).length !== 64) throw new ProofError("invalid_signature", 400);
  await db.query(`UPDATE bounty_proofs SET wallet_signature = $2, wallet_action = $3,
    attempted_at = now(), attempt_count = attempt_count + CASE WHEN wallet_signature = $2 THEN 0 ELSE 1 END
    WHERE bounty_id = $1 AND decision_action = $3 AND status IN ('pending_review', 'disputed')`,
  [id, input.signature, input.action]);
  return refreshSettlement(db, rpc, viewer, id);
}
