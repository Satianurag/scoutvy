import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import { ProofError } from "./proof-error.js";

/** Operator-only: called by the database-authenticated CLI, never a public route. */
export async function pendingReports(db: Db) {
  return db.query(`SELECT r.id,r.bounty_id,r.reason,r.details,r.created_at,
    b.title,b.status AS bounty_status,b.hidden_at
    FROM bounty_reports r JOIN bounties b ON b.id=r.bounty_id
    WHERE r.status='pending' ORDER BY r.created_at,r.id LIMIT 100`);
}

export async function moderateReport(db: Db, id: string, action: string, note: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    || !["dismiss", "hide", "restore"].includes(action)
    || note.trim().length < 10 || note.trim().length > 1000) {
    throw new ProofError("invalid_moderation_decision", 400);
  }
  // One statement records the decision and changes visibility atomically.
  const [decision] = await db.query(`WITH locked AS (
      SELECT r.id,r.bounty_id FROM bounty_reports r JOIN bounties b ON b.id=r.bounty_id
      WHERE r.id=$1 FOR UPDATE OF r,b
    ), decision AS (
      INSERT INTO moderation_decisions(id,report_id,bounty_id,action,note)
      SELECT $4,id,bounty_id,$2,$3 FROM locked RETURNING *
    ), visibility AS (
      UPDATE bounties b SET hidden_at=CASE WHEN d.action='hide' THEN COALESCE(b.hidden_at,now())
        WHEN d.action='restore' THEN NULL ELSE b.hidden_at END
      FROM decision d WHERE b.id=d.bounty_id RETURNING b.id
    ), reviewed AS (
      UPDATE bounty_reports r SET status='reviewed' FROM decision d WHERE r.id=d.report_id RETURNING r.id
    ) SELECT id,report_id,bounty_id,action,created_at FROM decision`, [id, action, note.trim(), randomUUID()]);
  if (!decision) throw new ProofError("report_not_found", 404);
  return decision;
}
