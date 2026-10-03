import { address } from "@solana/kit";
import { useWalletTransaction, WalletTransactionError } from "@/wallet/use-wallet-transaction";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useCallback, useRef, useState } from "react";

import {
  ApiError,
  confirmBounty,
  createBounty,
  recoverBounty,
  waitUntilActive,
  type Bounty,
  type NewBounty,
  type Session,
} from "@/auth/api";
import { classifyWalletError } from "@/auth/wallet-errors";
import { createBountyInstruction, simulate } from "@/post/escrow";
import { clearPendingPost, logWalletFailure, readPendingPost, savePendingPost } from "@/post/pending-post";

export type PostPhase =
  | { kind: "saving" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "confirming" }
  | { kind: "ready"; bounty: Bounty; canDiscard: boolean; canPost: boolean }
  | { kind: "open"; bounty: Bounty; signature: string }
  | { kind: "failed"; message: string; signature: string | null; reason?: "no_pending" };

const CONFIRM_ATTEMPTS = 30;
const CONFIRM_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class PostError extends Error {}

function failureMessage(error: unknown): string {
  if (error instanceof PostError || error instanceof WalletTransactionError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Reconnect your wallet, then check again. Your progress is saved.";
    if (error.code === "unconfirmed")
      return "Solana hasn't confirmed the transaction yet. Check again in a moment.";
    if (error.code === "failed") return "The transaction failed on Solana, so nothing was locked.";
    if (error.code === "mismatch") return "The transaction didn't lock this bounty's reward.";
    if (error.status === 503) return "Couldn't reach Solana to check the transaction. Try again.";
    return "Couldn't save the bounty. Try again.";
  }
  switch (classifyWalletError(error)) {
    case "cancelled":
      return "You cancelled in your wallet. Nothing was charged.";
    case "closed":
      return "The wallet connection closed. Check confirmation before trying again.";
    case "no_wallet":
      return "No Solana wallet found on this phone. Install one to continue.";
    case "network":
      return "Couldn't reach Scoutvy. Check your connection and try again.";
    default:
      return "Wallet approval couldn’t finish. Return to Scoutvy and check again.";
  }
}

/**
 * Posts a bounty: saves it as pending, locks the reward through the wallet, then waits for the server to
 * verify the escrow on-chain. A retry resumes from the last completed step so a reward is never locked twice.
 */
export function usePostBounty(session: Session, input?: NewBounty) {
  const wallet = useMobileWallet();
  const sendTransaction = useWalletTransaction(session.walletAddress);
  const [phase, setPhase] = useState<PostPhase>({ kind: "saving" });
  const bountyRef = useRef<Bounty | null>(null);
  const signatureRef = useRef<string | null>(null);
  const durationRef = useRef<number | undefined>(input?.durationHours);
  const running = useRef(false);

  const run = useCallback(async (checkOnly = false) => {
    if (running.current) return;
    running.current = true;
    try {
      setPhase({ kind: "confirming" });
      const pending = await readPendingPost(session.walletAddress);
      let bounty = bountyRef.current;
      if (pending) {
        bounty = await recoverBounty(session, pending.id);
        bountyRef.current = bounty;
        durationRef.current = pending.durationHours;
        signatureRef.current = bounty.signature ?? pending.signature;
        if (bounty.status !== "pending") {
          if (bounty.signature) {
            await clearPendingPost(session.walletAddress);
            setPhase({ kind: "open", bounty, signature: bounty.signature });
            return;
          }
          throw new PostError("This bounty has already ended. Check Activity for its status.");
        }
        const hasAttempt = !!signatureRef.current || pending.lastValidBlockHeight !== undefined;
        let retryReady = !hasAttempt;
        if (hasAttempt) {
          const status = signatureRef.current ? (await wallet.client.rpc.getSignatureStatuses(
            [signatureRef.current as Parameters<typeof wallet.client.rpc.getSignatureStatuses>[0][number]],
            { searchTransactionHistory: true },
          ).send()).value[0] : null;
          const failed = !!status?.err && status.confirmationStatus === "finalized";
          const expired = pending.lastValidBlockHeight !== undefined &&
            await wallet.client.rpc.getBlockHeight({ commitment: "finalized" }).send() > BigInt(pending.lastValidBlockHeight);
          if (failed || expired) {
            const { value: escrow } = await wallet.client.rpc.getAccountInfo(address(bounty.bountyAddress), {
              commitment: "finalized", encoding: "base64",
            }).send();
            // Recheck after expiry: a last-slot payment must never be forgotten or signed again.
            bounty = await recoverBounty(session, pending.id);
            bountyRef.current = bounty;
            if (bounty.status !== "pending") {
              if (!bounty.signature) throw new PostError("This bounty has ended. Check Activity for its status.");
              await clearPendingPost(session.walletAddress);
              setPhase({ kind: "open", bounty, signature: bounty.signature });
              return;
            }
            retryReady = !escrow && (!status || !!status.err);
          }
          if (retryReady) {
            signatureRef.current = null;
            pending.signature = null;
            delete pending.lastValidBlockHeight;
            await savePendingPost(session.walletAddress, pending);
            if (!checkOnly)
              throw new PostError("The previous payment didn’t complete. Tap Try again to approve it again.");
          }
        }
        if (checkOnly) {
          setPhase({ kind: "ready", bounty, canDiscard: retryReady, canPost: retryReady && Date.parse(bounty.expiresAt) - Date.now() >= 3_600_000 });
          return;
        }
        if (!retryReady)
          throw new PostError("Your previous payment may still complete. Check again in a moment before approving another transaction.");
        // A retry must use the same immutable bounty, never fund an edited replacement silently.
        if (input && (input.durationHours !== pending.durationHours || (Object.keys(input) as (keyof NewBounty)[]).some((key) =>
          key !== "durationHours" && input[key] !== bounty![key as keyof Bounty]))) {
          throw new PostError("Finish your previous bounty first. Close this screen and tap Continue above the bounty details.");
        }
      }
      if (!bounty) {
        if (!input) {
          setPhase({ kind: "failed", reason: "no_pending", message: "There is no unfinished bounty.", signature: null });
          return;
        }
        setPhase({ kind: "saving" });
        bounty = await createBounty(session, input);
        bountyRef.current = bounty;
        // Persist before opening the wallet. Storage failure must prevent signing.
        await savePendingPost(session.walletAddress, { id: bounty.id, signature: null, durationHours: input.durationHours });
      }

      if (!signatureRef.current) {
        setPhase({ kind: "simulating" });
        const poster = address(session.walletAddress);
        if (Date.parse(bounty.expiresAt) - Date.now() < 3_600_000)
          throw new PostError("This draft’s deadline is too close. Check confirmation, then discard it and post again.");
        const instruction = await createBountyInstruction({
          id: bounty.id, poster, mint: address(bounty.mint), amount: BigInt(bounty.amount),
          expiresAt: BigInt(Math.floor(Date.parse(bounty.expiresAt) / 1000)),
        });
        const dryRun = await simulate(wallet.client.rpc, poster, [instruction]);
        if (dryRun === "no_sol") throw new PostError("Add test SOL to cover the network fee, then try again.");
        if (dryRun === "no_tokens") throw new PostError("Your wallet doesn’t hold enough tokens for this reward.");
        if (dryRun !== "ok") throw new PostError("The reward couldn’t be prepared. Check confirmation before trying again.");
        let lastValidBlockHeight: string | undefined;
        setPhase({ kind: "signing" });
        try {
          signatureRef.current = await sendTransaction([instruction], async (lifetime) => {
            lastValidBlockHeight = lifetime.lastValidBlockHeight.toString();
            await savePendingPost(session.walletAddress, {
              id: bounty.id, signature: null, durationHours: durationRef.current, lastValidBlockHeight,
            });
          });
        } catch (error) {
          if (error instanceof WalletTransactionError && error.definitelyNotSubmitted) {
            await savePendingPost(session.walletAddress, {
              id: bounty.id, signature: null, durationHours: durationRef.current,
            });
          }
          throw error;
        }
        await savePendingPost(session.walletAddress, {
          id: bounty.id, signature: signatureRef.current, durationHours: durationRef.current, lastValidBlockHeight,
        });
      }
      setPhase({ kind: "confirming" });
      await waitUntilActive();
      for (let attempt = 1; ; attempt++) {
        try {
          const opened = await confirmBounty(session, bounty.id, signatureRef.current);
          await clearPendingPost(session.walletAddress);
          setPhase({ kind: "open", bounty: opened, signature: signatureRef.current });
          return;
        } catch (error) {
          const pending = error instanceof ApiError && error.code === "unconfirmed";
          if (!pending || attempt >= CONFIRM_ATTEMPTS) throw error;
          await sleep(CONFIRM_INTERVAL_MS);
        }
      }
    } catch (error) {
      logWalletFailure(error);
      setPhase({ kind: "failed", message: failureMessage(error), signature: signatureRef.current });
    } finally {
      running.current = false;
    }
  }, [session, input, wallet, sendTransaction]);

  const discard = async () => {
    // Recheck both the chain and blockhash expiry immediately before forgetting a payment attempt.
    const pending = await readPendingPost(session.walletAddress);
    if (!pending) return true;
    if (pending.signature || pending.lastValidBlockHeight !== undefined) {
      const status = pending.signature ? (await wallet.client.rpc.getSignatureStatuses(
        [pending.signature as Parameters<typeof wallet.client.rpc.getSignatureStatuses>[0][number]],
        { searchTransactionHistory: true },
      ).send()).value[0] : null;
      const failed = !!status?.err && status.confirmationStatus === "finalized";
      const expired = pending.lastValidBlockHeight !== undefined &&
        await wallet.client.rpc.getBlockHeight({ commitment: "finalized" }).send() > BigInt(pending.lastValidBlockHeight);
      if ((!failed && !expired) || (status && !status.err)) { await run(true); return false; }
    }
    // Read the account AFTER expiry was observed so a last-slot confirmation cannot be discarded.
    const bounty = await recoverBounty(session, pending.id);
    if (bounty.status !== "pending") { await run(true); return false; }
    const { value: escrow } = await wallet.client.rpc.getAccountInfo(address(bounty.bountyAddress), {
      commitment: "finalized", encoding: "base64",
    }).send();
    if (escrow) { await run(true); return false; }
    await clearPendingPost(session.walletAddress);
    return true;
  };
  return { phase, run, discard };
}
