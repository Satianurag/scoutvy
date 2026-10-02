import { createSolanaRpc } from "@solana/kit";

import { authenticate, readJson } from "../../lib/auth.js";
import { activity } from "../../lib/activity.js";
import { createBounty, getBounty, parseBountyInput, parsePoint } from "../../lib/bounties.js";
import { SOLANA_DEVNET_RPC_URL } from "../../lib/config.js";
import { acceptBounty, getScoutState, parseProofMetadata, prepareCapture, ProofError, readProofImage, releaseClaim, submitProof } from "../../lib/proofs.js";
import { getReview, prepareDecision, protectedImage, recordDecision, refreshSettlement } from "../../lib/reviews.js";
import { resolverAddress } from "../../lib/settlement.js";

const privateHeaders = { "Cache-Control": "no-store" };

function proofError(error: unknown) {
  if (error instanceof ProofError) return Response.json({ error: error.code }, { status: error.status, headers: privateHeaders });
  return Response.json({ error: "service_unavailable" }, { status: 503, headers: privateHeaders });
}

export async function GET(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  if (["review", "image", "activity"].includes(params.get("action") ?? "")) {
    try {
      const rpc = createSolanaRpc(SOLANA_DEVNET_RPC_URL);
      if (params.get("action") === "activity") return Response.json(await activity(db, walletAddress, params.get("before"), await resolverAddress(rpc)), { headers: privateHeaders });
      if (params.get("action") === "image") {
        const image = await protectedImage(db, walletAddress, params.get("id") ?? "", await resolverAddress(rpc));
        return new Response(new Uint8Array(image), { headers: { ...privateHeaders, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" } });
      }
      return Response.json({ review: await getReview(db, rpc, walletAddress, params.get("id") ?? "") }, { headers: privateHeaders });
    } catch (error) { return proofError(error); }
  }
  if (params.get("action") === "scout") {
    try {
      return Response.json({ scout: await getScoutState(db, walletAddress, params.get("id") ?? "") }, { headers: privateHeaders });
    } catch (error) {
      return proofError(error);
    }
  }
  const bounty = await getBounty(db, walletAddress, params.get("id") ?? "", parsePoint(params.get("lat"), params.get("lng")));
  if (!bounty) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ bounty }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { db, walletAddress } = await authenticate(request);
  if (!walletAddress) return Response.json({ error: "unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const action = params.get("action");
  if (action) {
    try {
      const id = params.get("id") ?? "";
      if (action === "record-decision") {
        return Response.json({ review: await recordDecision(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id, await readJson(request)) }, { headers: privateHeaders });
      }
      if (action === "approve" || action === "dispute" || action === "resolve") {
        return Response.json(await prepareDecision(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id, action, await readJson(request)), { headers: privateHeaders });
      }
      if (action === "retry-settlement" || action === "release-reward") {
        return Response.json({ review: await refreshSettlement(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id, action === "release-reward") }, { headers: privateHeaders });
      }
      if (action === "accept") {
        const scout = await acceptBounty(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id);
        return Response.json({ scout }, { headers: privateHeaders });
      }
      if (action === "capture") {
        return Response.json({ capture: await prepareCapture(db, walletAddress, id) }, { headers: privateHeaders });
      }
      if (action === "release") {
        await releaseClaim(db, walletAddress, id);
        return Response.json({ released: true }, { headers: privateHeaders });
      }
      if (action === "proof") {
        const state = await getScoutState(db, walletAddress, id);
        if (state.status !== "accepted" && state.status !== "submitted") throw new ProofError("claim_expired");
        let metadata: unknown;
        try { metadata = JSON.parse(request.headers.get("x-proof-metadata") ?? ""); }
        catch { throw new ProofError("invalid_metadata", 400); }
        const proof = await submitProof(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id,
          parseProofMetadata(metadata), await readProofImage(request));
        await refreshSettlement(db, createSolanaRpc(SOLANA_DEVNET_RPC_URL), walletAddress, id);
        return Response.json({ proof }, { status: 201, headers: privateHeaders });
      }
      throw new ProofError("invalid_action", 400);
    } catch (error) {
      return proofError(error);
    }
  }
  const body = await readJson(request);
  if (body === undefined) return Response.json({ error: "invalid_json" }, { status: 400 });
  const parsed = parseBountyInput(body);
  if ("invalid" in parsed) return Response.json({ error: `invalid_${parsed.invalid}` }, { status: 400 });
  const bounty = await createBounty(db, walletAddress, parsed.input);
  return Response.json({ bounty }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
