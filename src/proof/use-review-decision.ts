import { logReviewFailure, useWalletTransaction, WalletTransactionError, type ReviewDiagnosticStage } from "@/wallet/use-wallet-transaction";
import { address } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useRef, useState } from "react";

import {
  ApiError,
  prepareReviewDecision,
  recordReviewDecision,
  refreshReview,
  waitUntilActive,
  type Review,
  type ReviewAction,
  type Session,
} from "@/auth/api";
import { classifyWalletError } from "@/auth/wallet-errors";
import { simulate } from "@/post/escrow";
import { disputeInstruction, settlementInstructions } from "@/post/settlement";

export type DecisionPhase = "idle" | "checking" | "signing" | "confirming" | "failed";
class ReviewActionError extends Error {}

export function reviewError(error: unknown) {
  if (error instanceof ReviewActionError || error instanceof WalletTransactionError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Reconnect your wallet, then check this decision again.";
    if (error.code === "review_ended") return "The review window ended. Refresh to check the reward.";
    if (error.code === "decision_conflict")
      return "A different decision is already saved. Refresh to continue with that decision.";
    if (error.code === "chain_mismatch")
      return "The escrow does not match this submission. No payment was confirmed.";
    if (error.code === "unconfirmed")
      return "Solana has not confirmed yet. Check again before making another decision.";
    if (error.code === "review_not_configured" || error.code === "review_funding_unavailable")
      return "Review is temporarily unavailable. The submission is saved. Try again later.";
    if (error.status === 403) return "This wallet cannot review this submission.";
    if (error.status === 404) return "This submission is not available to this wallet.";
    if (error.status === 503) return "Couldn’t check the escrow. Check your connection and try again.";
    return "This decision could not be completed. Refresh to check its current status.";
  }
  if (classifyWalletError(error) === "cancelled")
    return "You cancelled in your wallet. No new decision was confirmed.";
  return "Couldn’t complete this request. Your submission is saved. Check again.";
}

export function useReviewDecision(session: Session, id: string, onReview: (review: Review) => void) {
  const wallet = useMobileWallet();
  const sendTransaction = useWalletTransaction(session.walletAddress);
  const running = useRef(false);
  const [phase, setPhase] = useState<DecisionPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const run = async (action?: ReviewAction, reason?: string, payScout?: boolean, release = false) => {
    if (running.current) return;
    running.current = true;
    setError(null);
    setPhase("checking");
    const started = Date.now();
    let stage: ReviewDiagnosticStage = "prepare";
    try {
      if (action) {
        const prepared = await prepareReviewDecision(session, id, action, reason, payScout);
        onReview(prepared.review);
        const tx = prepared.transaction;
        if (tx) {
          const signer = address(session.walletAddress);
          const instructions =
            tx.action === "dispute"
              ? [await disputeInstruction(signer, address(tx.bounty), tx.digest!)]
              : await settlementInstructions(
                  signer,
                  {
                    bounty: address(tx.bounty),
                    poster: address(tx.poster),
                    mint: address(tx.mint),
                    recipient: address(tx.recipient),
                  },
                  tx.action,
                  tx.action === "resolve" ? { payScout: tx.payScout, digest: tx.digest! } : undefined,
                );
          stage = "simulate";
          const simulation = await simulate(wallet.client.rpc, signer, instructions);
          if (simulation !== "ok") {
            stage = "refresh";
            const latest = await refreshReview(session, id);
            onReview(latest);
            if (
              latest.status === "paid" ||
              latest.status === "refunded" ||
              (latest.status === "disputed" && action === "dispute")
            ) {
              setPhase("idle");
              return;
            }
            stage = "simulate";
            throw new ReviewActionError(
              simulation === "no_sol"
                ? "Your wallet needs devnet SOL for network costs. Add devnet SOL, then retry your saved decision."
                : "This transaction could not be validated. Refresh the status before retrying.",
            );
          }
          setPhase("signing");
          stage = "wallet";
          const signature = await sendTransaction(instructions);
          stage = "record";
          await waitUntilActive();
          await recordReviewDecision(session, id, action, signature);
        }
      }
      setPhase("confirming");
      stage = "refresh";
      let latest = await refreshReview(session, id, release);
      for (let attempt = 0; action && attempt < 15; attempt++) {
        if (
          latest.status === "paid" ||
          latest.status === "refunded" ||
          (latest.status === "disputed" && action === "dispute")
        )
          break;
        await new Promise((resolve) => setTimeout(resolve, 1000));
        latest = await refreshReview(session, id);
      }
      onReview(latest);
      if (
        (action && latest.status === "pending_review") ||
        (action === "resolve" && latest.status === "disputed")
      )
        throw new ApiError(503, "unconfirmed", "review");
      setPhase("idle");
    } catch (cause) {
      logReviewFailure(stage, started, cause);
      setError(reviewError(cause));
      setPhase("failed");
    } finally {
      running.current = false;
    }
  };
  return {
    phase,
    error,
    busy: phase !== "idle" && phase !== "failed",
    run,
    reset: () => {
      setPhase("idle");
      setError(null);
    },
  };
}
