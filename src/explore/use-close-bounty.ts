import { useWalletTransaction, WalletTransactionError } from "@/wallet/use-wallet-transaction";
import { address, isSignature, type Signature } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import * as SecureStore from "expo-secure-store";
import { useCallback, useRef, useState } from "react";

import { ApiError, closeBounty, waitUntilActive, type BountyView, type Session } from "@/auth/api";
import { classifyWalletError } from "@/auth/wallet-errors";
import { logWalletFailure } from "@/post/pending-post";
import { cancelBountyInstruction, refundExpiredInstruction, simulate } from "@/post/escrow";

export type ClosePhase =
  | { kind: "idle" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "confirming" }
  | { kind: "closed"; bounty: BountyView }
  | { kind: "failed"; message: string };

const CONFIRM_ATTEMPTS = 30;
const CONFIRM_INTERVAL_MS = 2000;
const PENDING_CODES = new Set(["still_open", "unconfirmed"]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class CloseError extends Error {}

type PendingClose = { signature: Signature | null; lastValidBlockHeight: string };
const recoveryKey = (wallet: string, id: string) => `scoutvy-pending-close-${wallet}-${id}`;
async function readPendingClose(key: string): Promise<PendingClose | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const value = JSON.parse(raw) as PendingClose;
  if (!value || (value.signature !== null && !isSignature(value.signature))
    || typeof value.lastValidBlockHeight !== "string" || !/^\d+$/.test(value.lastValidBlockHeight))
    throw new CloseError("Couldn’t read the previous refund attempt. Keep this screen open and try again.");
  return value;
}

function failureMessage(error: unknown): string {
  if (error instanceof CloseError || error instanceof WalletTransactionError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Reconnect your wallet, then check again. Your progress is saved.";
    if (error.code === "not_open") return "A submission protects this reward. Open Activity to review it.";
    if (error.code && PENDING_CODES.has(error.code)) return "Solana hasn't confirmed the refund yet. Check again in a moment.";
    if (error.status === 503) return "Couldn't reach Solana to check the refund. Try again.";
    return "Couldn't update the bounty. Try again.";
  }
  switch (classifyWalletError(error)) {
    case "cancelled":
      return "You cancelled in your wallet. The bounty is still open.";
    case "closed":
      return "Your wallet closed before approving. The bounty is still open.";
    case "no_wallet":
      return "No Solana wallet found on this phone. Install one to continue.";
    case "network":
      return "Couldn't reach Scoutvy. Check your connection and try again.";
    default:
      return "Your wallet couldn't send the transaction. Try again.";
  }
}

/**
 * Returns a poster's escrowed reward: cancels before expiry, refunds after it, then waits for the server
 * to see the escrow closed on-chain. A previous attempt must be proven unable to land before a new approval.
 */
export function useCloseBounty(session: Session, bounty: BountyView | null) {
  const wallet = useMobileWallet();
  const sendTransaction = useWalletTransaction(session.walletAddress);
  const [phase, setPhase] = useState<ClosePhase>({ kind: "idle" });
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!bounty || running.current) return;
    running.current = true;
    const key = recoveryKey(session.walletAddress, bounty.id);
    let savedUnsentLifetime = false;
    const markClosed = async (closed: BountyView) => {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      setPhase({ kind: "closed", bounty: closed });
    };
    try {
      setPhase({ kind: "confirming" });
      // Reconcile first, including after process loss or an interrupted wallet handoff.
      try {
        await markClosed(await closeBounty(session, bounty.id));
        return;
      } catch (error) {
        if (!(error instanceof ApiError) || error.code !== "still_open") throw error;
      }
      const pending = await readPendingClose(key);
      if (pending) {
        const status = pending.signature
          ? (await wallet.client.rpc.getSignatureStatuses([pending.signature], { searchTransactionHistory: true }).send()).value[0]
          : null;
        const failed = !!status?.err && status.confirmationStatus === "finalized";
        const expired = await wallet.client.rpc.getBlockHeight({ commitment: "finalized" }).send()
          > BigInt(pending.lastValidBlockHeight);
        if (!failed && !expired)
          throw new CloseError("Your previous refund is still being checked. Try again in a moment.");
        // A stale API/RPC response must not turn an already landed refund into a new signing request.
        if (!bounty.bountyAddress) throw new CloseError("Couldn’t verify this bounty’s escrow. Try again.");
        const { value: escrow } = await wallet.client.rpc.getAccountInfo(address(bounty.bountyAddress), {
          commitment: "finalized", encoding: "base64",
        }).send();
        if (!escrow || (status && !status.err))
          throw new CloseError("Your refund is being confirmed. Check again in a moment.");
        try {
          await markClosed(await closeBounty(session, bounty.id));
          return;
        } catch (error) {
          if (!(error instanceof ApiError) || error.code !== "still_open") throw error;
        }
        await SecureStore.deleteItemAsync(key);
        // Require a separate user action; never automatically open a second financial approval.
        throw new CloseError("The previous attempt didn’t complete. Tap Try Again to approve a new refund.");
      }
      {
        setPhase({ kind: "simulating" });
        const poster = address(session.walletAddress);
        const target = { id: bounty.id, poster, mint: address(bounty.mint) };
        const expired = Date.parse(bounty.expiresAt) <= Date.now();
        const instruction = expired ? await refundExpiredInstruction(poster, target) : await cancelBountyInstruction(target);
        const dryRun = await simulate(wallet.client.rpc, poster, [instruction]);
        if (dryRun === "no_sol") throw new CloseError("You need a little devnet SOL in this wallet to pay the network fee.");
        if (dryRun !== "ok") {
          const alreadyClosed = await closeBounty(session, bounty.id).catch(() => null);
          if (alreadyClosed) {
            await markClosed(alreadyClosed);
            return;
          }
          throw new CloseError("Solana rejected the refund in a dry run, so nothing was sent.");
        }

        setPhase({ kind: "signing" });
        let lastValidBlockHeight = "";
        const signature = await sendTransaction([instruction], async (lifetime) => {
          lastValidBlockHeight = lifetime.lastValidBlockHeight.toString();
          await SecureStore.setItemAsync(key, JSON.stringify({ signature: null, lastValidBlockHeight }));
          savedUnsentLifetime = true;
        });
        if (lastValidBlockHeight) {
          await SecureStore.setItemAsync(key, JSON.stringify({ lastValidBlockHeight, signature })).catch(() => undefined);
        }
      }

      setPhase({ kind: "confirming" });
      await waitUntilActive();
      for (let attempt = 1; ; attempt++) {
        try {
          await markClosed(await closeBounty(session, bounty.id));
          return;
        } catch (error) {
          const pending = error instanceof ApiError && error.code !== undefined && PENDING_CODES.has(error.code);
          if (!pending || attempt >= CONFIRM_ATTEMPTS) throw error;
          await sleep(CONFIRM_INTERVAL_MS);
        }
      }
    } catch (error) {
      if (savedUnsentLifetime && error instanceof WalletTransactionError && error.definitelyNotSubmitted)
        await SecureStore.deleteItemAsync(key).catch(() => undefined);
      logWalletFailure(error, "close");
      setPhase({ kind: "failed", message: failureMessage(error) });
    } finally {
      running.current = false;
    }
  }, [session, bounty, wallet, sendTransaction]);

  return { phase, run };
}
