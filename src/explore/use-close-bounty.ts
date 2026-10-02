import { address } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useCallback, useRef, useState } from "react";

import { ApiError, closeBounty, waitUntilActive, type BountyView, type Session } from "@/auth/api";
import { classifyWalletError } from "@/auth/wallet-errors";
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

function failureMessage(error: unknown): string {
  if (error instanceof CloseError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign out and sign in again.";
    if (error.code === "not_open") return "A submitted proof protects this reward. Open Activity to review it.";
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
 * to see the escrow closed on-chain. A retry after a sent transaction only re-checks, so it never signs twice.
 */
export function useCloseBounty(session: Session, bounty: BountyView | null) {
  const wallet = useMobileWallet();
  const [phase, setPhase] = useState<ClosePhase>({ kind: "idle" });
  const sent = useRef(false);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (!bounty || running.current) return;
    running.current = true;
    try {
      if (!sent.current) {
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
            setPhase({ kind: "closed", bounty: alreadyClosed });
            return;
          }
          throw new CloseError("Solana rejected the refund in a dry run, so nothing was sent.");
        }

        setPhase({ kind: "signing" });
        if (!wallet.account) {
          await wallet.connect();
          throw new CloseError("Your wallet is reconnected. Tap Try again to continue.");
        }
        if (wallet.account.address !== session.walletAddress) {
          throw new CloseError("Your wallet is on a different account than the one you signed in with.");
        }
        await wallet.sendTransactions([instruction]);
        sent.current = true;
      }

      setPhase({ kind: "confirming" });
      await waitUntilActive();
      for (let attempt = 1; ; attempt++) {
        try {
          setPhase({ kind: "closed", bounty: await closeBounty(session, bounty.id) });
          return;
        } catch (error) {
          const pending = error instanceof ApiError && error.code !== undefined && PENDING_CODES.has(error.code);
          if (!pending || attempt >= CONFIRM_ATTEMPTS) throw error;
          await sleep(CONFIRM_INTERVAL_MS);
        }
      }
    } catch (error) {
      setPhase({ kind: "failed", message: failureMessage(error) });
    } finally {
      running.current = false;
    }
  }, [session, bounty, wallet]);

  return { phase, run };
}
