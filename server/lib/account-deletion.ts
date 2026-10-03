import type { Db } from "./db.js";

export async function deletionEligibility(db: Db, wallet: string) {
  const [row] = await db.query<{ retained: boolean; active: boolean; bounty_ids: string[] }>(
    `SELECT (
       EXISTS (SELECT 1 FROM bounties WHERE poster_wallet=$1)
       OR EXISTS (SELECT 1 FROM scout_claims WHERE scout_wallet=$1)
       OR EXISTS (SELECT 1 FROM bounty_proofs WHERE scout_wallet=$1)
     ) AS retained, EXISTS (
       SELECT 1 FROM bounties b
       LEFT JOIN scout_claims c ON c.bounty_id=b.id
       WHERE b.status='open'
       AND (b.poster_wallet=$1 OR (c.scout_wallet=$1 AND (
         c.expires_at>now() OR EXISTS (SELECT 1 FROM bounty_proofs p
           WHERE p.bounty_id=b.id AND p.status IN ('pending_review','disputed'))
       )))
     ) AS active, ARRAY(
       SELECT id FROM bounties WHERE poster_wallet=$1
       UNION SELECT bounty_id FROM scout_claims WHERE scout_wallet=$1
       UNION SELECT bounty_id FROM bounty_proofs WHERE scout_wallet=$1
     ) AS bounty_ids`, [wallet],
  );
  return { eligible: true, reason: null, retainedRecords: row.retained, activeBounties: row.active, bountyIds: row.bounty_ids };
}

export async function deleteAccount(db: Db, wallet: string) {
  await db.query("SELECT scoutvy_delete_account($1) AS deleted", [wallet]);
  return { deleted: true };
}
