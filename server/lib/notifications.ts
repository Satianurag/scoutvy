import type { Db } from "./db.js";
import { ProofError } from "./proof-error.js";
export async function notificationSettings(
  db: Db,
  wallet: string,
  method: string,
  body: unknown,
  sessionHash?: string,
) {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  if (
    typeof input.token !== "string" ||
    !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(input.token) ||
    input.token.length > 200
  )
    throw new ProofError("invalid_token", 400);
  if (method === "DELETE") {
    await db.query("DELETE FROM push_devices WHERE token=$1 AND wallet_address=$2", [input.token, wallet]);
    return { ok: true };
  }
  if (input.read === true) {
    const [row] = await db.query<{ reviews: boolean; rewards: boolean }>(
      "SELECT reviews,rewards FROM push_devices WHERE token=$1 AND wallet_address=$2",
      [input.token, wallet],
    );
    return { enabled: !!row, reviews: row?.reviews ?? true, rewards: row?.rewards ?? true };
  }
  if (method !== "POST" || typeof input.reviews !== "boolean" || typeof input.rewards !== "boolean")
    throw new ProofError("invalid_preferences", 400);
  if (!sessionHash) throw new ProofError("unauthorized", 401);
  await db.query(
    `INSERT INTO push_devices(token,wallet_address,reviews,rewards,session_hash) VALUES($1,$2,$3,$4,$5) ON CONFLICT(token) DO UPDATE SET wallet_address=EXCLUDED.wallet_address,reviews=EXCLUDED.reviews,rewards=EXCLUDED.rewards,session_hash=EXCLUDED.session_hash,updated_at=now()`,
    [input.token, wallet, input.reviews, input.rewards, sessionHash],
  );
  // A token changing wallets must not retain queued messages for its previous account.
  await db.query("DELETE FROM push_outbox WHERE token=$1 AND message->'data'->>'wallet'<>$2", [
    input.token,
    wallet,
  ]);
  return { enabled: true, reviews: input.reviews, rewards: input.rewards };
}
async function expo(path: string, body: unknown) {
  const response = await fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("push_unavailable");
  return response.json();
}
/** Enqueue only recorded state; repeated API requests cannot duplicate a notification. */
export async function notifyBounty(db: Db, id: string) {
  const [b] = await db.query<{
    id: string;
    title: string;
    poster_wallet: string;
    scout_wallet: string | null;
    status: string;
    proof_status: string | null;
    received_at: string | null;
    attestation_signature: string | null;
    confirmed_at: string | null;
    opened_at: string | null;
  }>(
    `SELECT b.id,b.title,b.poster_wallet,b.status,b.opened_at,c.scout_wallet,c.confirmed_at,p.status AS proof_status,p.received_at,p.attestation_signature FROM bounties b LEFT JOIN scout_claims c ON c.bounty_id=b.id LEFT JOIN bounty_proofs p ON p.bounty_id=b.id WHERE b.id=$1`,
    [id],
  );
  if (!b) return;
  const events: {
    kind: string;
    title: string;
    wallet: string;
    review: boolean;
    category: "reviews" | "rewards";
  }[] = [];
  if (["paid", "refunded"].includes(b.proof_status ?? ""))
    for (const wallet of new Set([b.poster_wallet, b.scout_wallet].filter((x): x is string => !!x)))
      events.push({
        kind: b.proof_status!,
        title: b.proof_status === "paid" ? "Reward paid" : "Reward refunded",
        wallet,
        review: true,
        category: "rewards",
      });
  else if (["cancelled", "expired"].includes(b.status))
    events.push({
      kind: b.status,
      title: "Reward returned",
      wallet: b.poster_wallet,
      review: false,
      category: "rewards",
    });
  else if (b.proof_status === "disputed" && b.scout_wallet)
    events.push({
      kind: "disputed",
      title: "Proof disputed",
      wallet: b.scout_wallet,
      review: true,
      category: "reviews",
    });
  else if (b.received_at) {
    events.push({
      kind: "submitted",
      title: "New proof to review",
      wallet: b.poster_wallet,
      review: true,
      category: "reviews",
    });
    if (b.attestation_signature && b.scout_wallet)
      events.push({
        kind: "protected",
        title: "Proof in review",
        wallet: b.scout_wallet,
        review: true,
        category: "reviews",
      });
  } else if (b.confirmed_at)
    events.push({
      kind: "accepted",
      title: "Bounty accepted",
      wallet: b.poster_wallet,
      review: false,
      category: "reviews",
    });
  for (const event of events) {
    await db.query(
      `INSERT INTO push_outbox(id,token,event_key,message) SELECT gen_random_uuid(),d.token,$1,jsonb_build_object('to',d.token,'title',$2::text,'body',$3::text,'sound','default','channelId','bounty-updates','data',jsonb_build_object('wallet',$4::text,'bountyId',$5::text,'review',$6::boolean,'category',$7::text)) FROM push_devices d WHERE d.wallet_address=$4 AND d.${event.category}=true ON CONFLICT(token,event_key) DO NOTHING`,
      [`${id}:${event.kind}`, event.title, "Open Scoutvy to view this update.", event.wallet, id, event.review, event.category],
    );
  }
  await flushPush(db);
}
/** Lease queued batches before HTTP delivery; failure retries are bounded and durable. */
export async function flushPush(db: Db) {
  await db.query(
    `DELETE FROM push_outbox o USING push_devices d WHERE o.token=d.token AND ((o.message->'data'->>'wallet')<>d.wallet_address OR (o.message->'data'->>'category'='reviews' AND NOT d.reviews) OR (o.message->'data'->>'category'='rewards' AND NOT d.rewards) OR NOT EXISTS(SELECT 1 FROM sessions s WHERE s.token_hash=d.session_hash AND s.wallet_address=d.wallet_address AND s.expires_at>now()))`,
  );
  const pending = await db.query<{ id: string; token: string; message: unknown }>(
    `UPDATE push_outbox SET attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' WHERE id IN(SELECT id FROM push_outbox WHERE sent_at IS NULL AND attempts<6 AND next_attempt_at<=now() ORDER BY created_at LIMIT 100 FOR UPDATE SKIP LOCKED) RETURNING id,token,message`,
  );
  if (pending.length) {
    try {
      const response = (await expo(
        "send",
        pending.map((x) => x.message),
      )) as { data?: { status: string; id?: string; details?: { error?: string } }[] };
      if (!Array.isArray(response.data) || response.data.length !== pending.length)
        throw new Error("push_response");
      for (let i = 0; i < pending.length; i++) {
        const ticket = response.data[i];
        if (ticket.status === "ok" && ticket.id)
          await db.query("UPDATE push_outbox SET sent_at=now(),ticket_id=$2 WHERE id=$1", [
            pending[i].id,
            ticket.id,
          ]);
        else if (ticket.details?.error === "DeviceNotRegistered")
          await db.query("DELETE FROM push_devices WHERE token=$1", [pending[i].token]);
      }
    } catch {
      console.error("push_delivery_retry_scheduled");
    }
  }
  const receipts = await db.query<{ id: string; token: string; ticket_id: string }>(
    "SELECT id,token,ticket_id FROM push_outbox WHERE sent_at<now()-interval '15 minutes' AND receipt_checked_at IS NULL AND ticket_id IS NOT NULL LIMIT 100",
  );
  if (receipts.length) {
    try {
      const response = (await expo("getReceipts", { ids: receipts.map((x) => x.ticket_id) })) as {
        data?: Record<string, { status: string; details?: { error?: string } }>;
      };
      for (const row of receipts) {
        const receipt = response.data?.[row.ticket_id];
        if (!receipt) continue;
        if (receipt.details?.error === "DeviceNotRegistered")
          await db.query("DELETE FROM push_devices WHERE token=$1", [row.token]);
        else await db.query("UPDATE push_outbox SET receipt_checked_at=now() WHERE id=$1", [row.id]);
      }
    } catch {
      console.error("push_receipt_check_unavailable");
    }
  }
  await db.query("DELETE FROM push_outbox WHERE created_at<now()-interval '7 days'");
}
export async function safeNotify(db: Db, id: string) {
  try {
    await notifyBounty(db, id);
  } catch {
    console.error("push_enqueue_unavailable");
  }
}
