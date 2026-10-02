import type { Db } from "./db.js";
import { BOUNTY_TOKENS } from "./escrow.js";
import { ProofError } from "./proofs.js";

type EventRow = { id: string; bounty_id: string; kind: string; title: string; occurred_at: Date | string; cursor_at: string; mint: string; amount: string; mine: boolean };

export async function activity(db: Db, viewer: string, before?: string | null, resolver?: string) {
  const cursor = before?.split("|");
  if (cursor && (cursor.length !== 3 || !Number.isFinite(Date.parse(cursor[0])) || !/^[0-9a-f-]{36}$/i.test(cursor[1]) || !/^[a-z_]+$/.test(cursor[2]))) throw new ProofError("invalid_cursor", 400);
  const rows = await db.query<EventRow>(
    `WITH owned AS (
       SELECT b.*, b.poster_wallet = $1 AS mine, c.scout_wallet, c.accepted_at,
         p.received_at, p.review_deadline, p.status AS proof_status, p.attestation_signature, p.dispute_signature,
         p.reviewed_at, p.settled_at, p.settlement_signature, p.attempted_at, p.last_error, p.decision_action, p.decision_prepared_at
       FROM bounties b LEFT JOIN scout_claims c ON c.bounty_id = b.id LEFT JOIN bounty_proofs p ON p.bounty_id = b.id
       WHERE b.poster_wallet = $1 OR c.scout_wallet = $1 OR ($1 = $5 AND p.dispute_signature IS NOT NULL)
     ), events AS (
       SELECT id AS bounty_id, title, mint, amount, mine, 'posted' AS kind, opened_at AS occurred_at FROM owned WHERE mine AND opened_at IS NOT NULL
       UNION ALL SELECT id, title, mint, amount, mine, 'accepted', accepted_at FROM owned WHERE scout_wallet = $1
       UNION ALL SELECT id, title, mint, amount, mine, CASE WHEN mine THEN 'review' ELSE 'submitted' END, received_at FROM owned WHERE received_at IS NOT NULL AND ($1 <> $5 OR mine OR scout_wallet = $1)
       UNION ALL SELECT id, title, mint, amount, mine, 'protected', review_deadline - interval '48 hours' FROM owned WHERE attestation_signature IS NOT NULL
       UNION ALL SELECT id, title, mint, amount, mine, 'disputed', reviewed_at FROM owned WHERE dispute_signature IS NOT NULL
       UNION ALL SELECT id, title, mint, amount, mine, 'retry', attempted_at FROM owned WHERE last_error IS NOT NULL AND settlement_signature IS NULL
       UNION ALL SELECT id, title, mint, amount, mine, 'decision_prepared', decision_prepared_at FROM owned WHERE decision_action IS NOT NULL AND settlement_signature IS NULL AND proof_status = 'pending_review'
       UNION ALL SELECT id, title, mint, amount, mine, proof_status, settled_at FROM owned WHERE settlement_signature IS NOT NULL
       UNION ALL SELECT id, title, mint, amount, mine, status, closed_at FROM owned WHERE mine AND status IN ('cancelled', 'expired')
       UNION ALL SELECT id, title, mint, amount, mine, 'expired_open', expires_at FROM owned WHERE mine AND status = 'open' AND expires_at <= now() AND received_at IS NULL
     )
     SELECT bounty_id::text || ':' || kind AS id, *, to_char(occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at FROM events
     WHERE occurred_at IS NOT NULL AND ($2::timestamptz IS NULL OR (occurred_at, bounty_id::text, kind) < ($2::timestamptz, $3, $4))
     ORDER BY occurred_at DESC, bounty_id DESC, kind DESC LIMIT 51`, [viewer, cursor?.[0] ?? null, cursor?.[1] ?? null, cursor?.[2] ?? null, resolver ?? ""],
  );
  const page = rows.slice(0, 50);
  return { events: page.map((row) => {
    const token = BOUNTY_TOKENS.find((t) => t.mint === row.mint);
    if (!token) throw new ProofError("chain_mismatch");
    return { id: row.id, bountyId: row.bounty_id, kind: row.kind, title: row.title,
      at: new Date(row.occurred_at).toISOString(), mint: row.mint, amount: String(row.amount), mine: row.mine,
      symbol: token.symbol, decimals: token.decimals };
  }), next: rows.length > 50 ? [page[49].cursor_at, page[49].bounty_id, page[49].kind].join("|") : null };
}
