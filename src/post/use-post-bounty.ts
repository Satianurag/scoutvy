import { address, signature as toSignature } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useCallback, useRef, useState } from "react";

import { ApiError, confirmBounty, createBounty, waitUntilActive, type Bounty, type NewBounty, type Session } from "@/auth/api";
import { classifyWalletError } from "@/auth/wallet-errors";
import { createBountyInstruction, simulate } from "@/post/escrow";

export type PostPhase =
  | { kind: "saving" }
  | { kind: "simulating" }
  | { kind: "signing" }
  | { kind: "confirming" }
  | { kind: "open"; bounty: Bounty; signature: string }
  | { kind: "failed"; message: string };

const CONFIRM_ATTEMPTS = 30;
const CONFIRM_INTERVAL_MS = 2000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class PostError extends Error {}

function failureMessage(error: unknown): string {
  if (error instanceof PostError) return error.message;
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign out and sign in again.";
    if (error.code === "unconfirmed") return "Solana hasn't confirmed the transaction yet. Check again in a moment.";
    if (error.code === "failed") return "The transaction failed on Solana, so nothing was locked.";
    if (error.code === "mismatch") return "The transaction didn't lock this bounty's reward.";
    if (error.status === 503) return "Couldn't reach Solana to check the transaction. Try again.";
    return "Couldn't save the bounty. Try again.";
  }
  switch (classifyWalletError(error)) {
    case "cancelled":
      return "You cancelled in your wallet. Nothing was charged.";
    case "closed":
      return "Your wallet closed before approving. Nothing was charged.";
    case "no_wallet":
      return "No Solana wallet found on this phone. Install one to continue.";
    case "network":
      return "Couldn't reach Scoutvy. Check your connection and try again.";
    default:
      return "Your wallet couldn't send the transaction. Try again.";
  }
}

/**
 * Posts a bounty: saves it as pending, locks the reward through the wallet, then waits for the server to
 * verify the escrow on-chain. A retry resumes from the last completed step so a reward is never locked twice.
 */
export function usePostBounty(session: Session, input: NewBounty) {
  const wallet = useMobileWallet();
  const [phase, setPhase] = useState<PostPhase>({ kind: "saving" });
  const bountyRef = useRef<Bounty | null>(null);
  const signatureRef = useRef<string | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      let bounty = bountyRef.current;
      if (!bounty) {
        setPhase({ kind: "saving" });
        bounty = await createBounty(session, input);
        bountyRef.current = bounty;
      }

      if (!signatureRef.current) {
        setPhase({ kind: "simulating" });
        const poster = address(session.walletAddress);
        const instruction = await createBountyInstruction({
          id: bounty.id,
          poster,
          mint: address(bounty.mint),
          amount: BigInt(bounty.amount),
          expiresAt: BigInt(Math.floor(Date.parse(bounty.expiresAt) / 1000)),
        });
        const dryRun = await simulate(wallet.client.rpc, poster, [instruction]);
        if (dryRun === "no_sol") throw new PostError("You need a little devnet SOL in this wallet to pay the network fee.");
        if (dryRun === "no_tokens") throw new PostError("Your wallet doesn't hold enough of this token for the reward.");
        if (dryRun === "failed") throw new PostError("Solana rejected this bounty in a dry run, so nothing was sent.");

        setPhase({ kind: "signing" });
        if (!wallet.account) {
          await wallet.connect();
          throw new PostError("Your wallet is reconnected. Tap Try again to post.");
        }
        if (wallet.account.address !== session.walletAddress) {
          throw new PostError("Your wallet is on a different account than the one you signed in with.");
        }
        signatureRef.current = await wallet.sendTransactions([instruction]);
      }

      setPhase({ kind: "confirming" });
      await waitUntilActive();
      const signature = toSignature(signatureRef.current);
      for (let attempt = 1; ; attempt++) {
        try {
          const opened = await confirmBounty(session, bounty.id, signature);
          setPhase({ kind: "open", bounty: opened, signature });
          return;
        } catch (error) {
          const pending = error instanceof ApiError && error.code === "unconfirmed";
          if (!pending || attempt >= CONFIRM_ATTEMPTS) {
            if (error instanceof ApiError && (error.code === "failed" || error.code === "mismatch")) {
              signatureRef.current = null;
            }
            throw error;
          }
          await sleep(CONFIRM_INTERVAL_MS);
        }
      }
    } catch (error) {
      setPhase({ kind: "failed", message: failureMessage(error) });
    } finally {
      running.current = false;
    }
  }, [session, input, wallet]);

  return { phase, run };
}
