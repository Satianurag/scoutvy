import { randomUUID } from "node:crypto";

import { address, isSignature, type Address } from "@solana/kit";

import type { Db } from "./db.js";
import { BOUNTY_TOKENS, ESCROW_PROGRAM_ID, bountyAddress, checkEscrow, type EscrowCheck, type EscrowRpc } from "./escrow.js";

export const TITLE_LENGTH = { min: 4, max: 60 };
export const INSTRUCTIONS_LENGTH = { min: 10, max: 500 };
export const LOCATION_LABEL_MAX = 120;
export const RADIUS_OPTIONS_M = [50, 100, 250, 500] as const;
export const DURATION_OPTIONS_H = [6, 24, 72, 168] as const;
export const MIN_REWARD_TOKENS = 1n;
export const MAX_REWARD_TOKENS = 500n;

export type BountyStatus = "pending" | "open" | "cancelled" | "expired";

export type Bounty = {
  id: string;
  title: string;
  instructions: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  radiusM: number;
  mint: string;
  amount: string;
  expiresAt: string;
  status: BountyStatus;
  bountyAddress: string;
  signature: string | null;
  programId: string;
};

type BountyRow = {
  id: string;
  poster_wallet: string;
  title: string;
  instructions: string;
  latitude: number;
  longitude: number;
  location_label: string;
  radius_m: number;
  mint: string;
  amount: string;
  expires_at: Date | string;
  status: BountyStatus;
  bounty_address: string;
  create_signature: string | null;
};

export type BountyInput = {
  title: string;
  instructions: string;
  latitude: number;
  longitude: number;
  locationLabel: string;
  radiusM: number;
  mint: Address;
  amount: bigint;
  durationHours: number;
};

export type InvalidField =
  | "title"
  | "instructions"
  | "location"
  | "location_label"
  | "radius"
  | "mint"
  | "amount"
  | "duration";

function toBounty(row: BountyRow): Bounty {
  return {
    id: row.id,
    title: row.title,
    instructions: row.instructions,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    locationLabel: row.location_label,
    radiusM: row.radius_m,
    mint: row.mint,
    amount: String(row.amount),
    expiresAt: new Date(row.expires_at).toISOString(),
    status: row.status,
    bountyAddress: row.bounty_address,
    signature: row.create_signature,
    programId: ESCROW_PROGRAM_ID,
  };
}

function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+\n/g, "\n");
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

export function parseBountyInput(body: unknown): { input: BountyInput } | { invalid: InvalidField } {
  const b = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const title = text(b.title, TITLE_LENGTH.min, TITLE_LENGTH.max);
  if (!title || title.includes("\n")) return { invalid: "title" };
  const instructions = text(b.instructions, INSTRUCTIONS_LENGTH.min, INSTRUCTIONS_LENGTH.max);
  if (!instructions) return { invalid: "instructions" };
  const { latitude, longitude } = b;
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { invalid: "location" };
  }
  const locationLabel = text(b.locationLabel, 1, LOCATION_LABEL_MAX);
  if (!locationLabel || locationLabel.includes("\n")) return { invalid: "location_label" };
  if (!RADIUS_OPTIONS_M.includes(b.radiusM as (typeof RADIUS_OPTIONS_M)[number])) return { invalid: "radius" };
  const token = BOUNTY_TOKENS.find((t) => t.mint === b.mint);
  if (!token) return { invalid: "mint" };
  if (typeof b.amount !== "string" || !/^[1-9][0-9]{0,19}$/.test(b.amount)) return { invalid: "amount" };
  const amount = BigInt(b.amount);
  const unit = 10n ** BigInt(token.decimals);
  if (amount < MIN_REWARD_TOKENS * unit || amount > MAX_REWARD_TOKENS * unit) return { invalid: "amount" };
  if (!DURATION_OPTIONS_H.includes(b.durationHours as (typeof DURATION_OPTIONS_H)[number])) {
    return { invalid: "duration" };
  }
  return {
    input: {
      title,
      instructions,
      latitude,
      longitude,
      locationLabel,
      radiusM: b.radiusM as number,
      mint: token.mint,
      amount,
      durationHours: b.durationHours as number,
    },
  };
}

export async function createBounty(db: Db, poster: string, input: BountyInput, now = new Date()): Promise<Bounty> {
  const id = randomUUID();
  const expiresAt = new Date((Math.floor(now.getTime() / 1000) + input.durationHours * 3600) * 1000);
  const pda = await bountyAddress(address(poster), id);
  const rows = await db.query<BountyRow>(
    `INSERT INTO bounties
       (id, poster_wallet, title, instructions, latitude, longitude, location_label, radius_m, mint, amount, expires_at, bounty_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      id,
      poster,
      input.title,
      input.instructions,
      input.latitude,
      input.longitude,
      input.locationLabel,
      input.radiusM,
      input.mint,
      input.amount.toString(),
      expiresAt.toISOString(),
      pda,
    ],
  );
  return toBounty(rows[0]);
}

export type ConfirmResult =
  | { status: "open"; bounty: Bounty }
  | { status: "not_found" | "invalid_signature" | "conflict" }
  | { status: Exclude<EscrowCheck, "funded"> };

export async function confirmBounty(
  db: Db,
  rpc: EscrowRpc,
  poster: string,
  id: unknown,
  signature: unknown,
): Promise<ConfirmResult> {
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return { status: "not_found" };
  if (typeof signature !== "string" || !isSignature(signature)) return { status: "invalid_signature" };
  const [row] = await db.query<BountyRow>("SELECT * FROM bounties WHERE id = $1 AND poster_wallet = $2", [id, poster]);
  if (!row) return { status: "not_found" };
  if (row.status === "open" && row.create_signature === signature) return { status: "open", bounty: toBounty(row) };
  if (row.status !== "pending") return { status: "conflict" };

  const check = await checkEscrow(
    rpc,
    {
      id,
      poster: address(poster),
      mint: address(row.mint),
      amount: BigInt(row.amount),
      expiresAt: BigInt(Math.floor(new Date(row.expires_at).getTime() / 1000)),
    },
    signature,
  );
  if (check !== "funded") return { status: check };

  try {
    const [updated] = await db.query<BountyRow>(
      `UPDATE bounties SET status = 'open', create_signature = $2, opened_at = now()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, signature],
    );
    if (updated) return { status: "open", bounty: toBounty(updated) };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "23505") return { status: "conflict" };
    throw error;
  }
  const [current] = await db.query<BountyRow>("SELECT * FROM bounties WHERE id = $1", [id]);
  return current?.status === "open" && current.create_signature === signature
    ? { status: "open", bounty: toBounty(current) }
    : { status: "conflict" };
}
