import { notificationSettings } from "./notifications.js";
import { deleteAccount, deletionEligibility } from "./account-deletion.js";
import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";
import { ProofError } from "./proof-error.js";
export async function accountRequest(
  db: Db,
  wallet: string,
  method: string,
  action: string,
  body: unknown,
  sessionHash?: string,
) {
  if (action === "notifications") return notificationSettings(db, wallet, method, body, sessionHash);
  if (action === "delete-account") {
    if (method === "GET") return deletionEligibility(db, wallet);
    if (method === "POST") return deleteAccount(db, wallet);
  }
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (action === "data-request") {
    if (method === "GET") {
      const [request] = await db.query(
        'SELECT id,status,created_at AS "createdAt" FROM account_data_requests WHERE wallet_address=$1 ORDER BY created_at DESC LIMIT 1',
        [wallet],
      );
      return { request: request ?? null };
    }
    if (method === "POST") {
      const [request] = await db.query(
        `INSERT INTO account_data_requests (id,wallet_address) VALUES ($1,$2) ON CONFLICT (wallet_address) WHERE status='pending' DO UPDATE SET wallet_address=EXCLUDED.wallet_address RETURNING id,status,created_at AS "createdAt"`,
        [randomUUID(), wallet],
      );
      return { request };
    }
    if (method === "DELETE") {
      await db.query(
        "UPDATE account_data_requests SET status='cancelled' WHERE wallet_address=$1 AND status='pending'",
        [wallet],
      );
      return { ok: true };
    }
  }
  if (action === "blocked") {
    if (method === "GET")
      return {
        users: await db.query(
          `SELECT x.id, COALESCE(u.username,'Scoutvy user') AS name FROM blocked_users x LEFT JOIN users u ON u.wallet_address=x.blocked_wallet WHERE x.wallet_address=$1 ORDER BY x.created_at DESC`,
          [wallet],
        ),
      };
    if (method === "DELETE" && typeof input.id === "string") {
      await db.query("DELETE FROM blocked_users WHERE id=$1::text::uuid AND wallet_address=$2", [
        /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : null,
        wallet,
      ]);
      return { ok: true };
    }
  }
  if (action === "sign-out-all" && method === "POST") {
    await db.query("DELETE FROM sessions WHERE wallet_address=$1", [wallet]);
    await db.query("DELETE FROM push_devices WHERE wallet_address=$1", [wallet]);
    return { ok: true };
  }
  throw new ProofError("invalid_action", 400);
}
export async function reportBounty(db: Db, wallet: string, id: string, body: unknown) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ProofError("not_found", 404);
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const allowed = ["unsafe", "privacy", "misleading", "spam", "other"];
  if (
    typeof input.reason !== "string" ||
    !allowed.includes(input.reason) ||
    typeof input.details !== "string" ||
    input.details.trim().length > 1000 ||
    (input.reason === "other" && input.details.trim().length < 10)
  )
    throw new ProofError("invalid_report", 400);
  const [b] = await db.query<{ poster_wallet: string }>(
    `SELECT b.poster_wallet FROM bounties b WHERE b.id=$1 AND b.status<>'pending' AND ((b.status='open' AND b.hidden_at IS NULL) OR b.poster_wallet=$2 OR EXISTS (SELECT 1 FROM scout_claims c WHERE c.bounty_id=b.id AND c.scout_wallet=$2))`,
    [id, wallet],
  );
  if (!b) throw new ProofError("not_found", 404);
  if (b.poster_wallet === wallet) throw new ProofError("own_bounty", 400);
  const [report] = await db.query(
    `INSERT INTO bounty_reports (id,reporter_wallet,bounty_id,reason,details) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (reporter_wallet,bounty_id) DO UPDATE SET reason=EXCLUDED.reason,details=EXCLUDED.details,status='pending' RETURNING id`,
    [randomUUID(), wallet, id, input.reason, input.details.trim()],
  );
  if (input.block === true)
    await db.query(
      `INSERT INTO blocked_users(id,wallet_address,blocked_wallet) VALUES ($1,$2,$3) ON CONFLICT(wallet_address,blocked_wallet) DO NOTHING`,
      [randomUUID(), wallet, b.poster_wallet],
    );
  return { report };
}
