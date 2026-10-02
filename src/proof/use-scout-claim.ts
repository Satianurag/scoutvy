import { address } from "@solana/kit";
import { useMobileWallet } from "@wallet-ui/react-native-kit";
import { useRef, useState } from "react";

import { acceptBounty, ApiError, confirmClaim, releaseClaim, waitUntilActive, type ScoutState, type Session } from "@/auth/api";
import { claimInstruction, simulate } from "@/post/escrow";

export function useScoutClaim(session: Session, id: string) {
  const wallet = useMobileWallet();
  const running = useRef(false);
  const [phase, setPhase] = useState("");

  const run = async (release = false): Promise<ScoutState | null> => {
    if (running.current) return null;
    running.current = true;
    setPhase("Checking acceptance…");
    try {
      const reservation = release ? await releaseClaim(session, id) : await acceptBounty(session, id);
      if ("released" in reservation && reservation.released) return null;
      if ("status" in reservation && reservation.status !== "reserved") return reservation;
      const bounty = "bountyAddress" in reservation ? reservation.bountyAddress : null;
      if (!bounty) throw new ApiError(409, "chain_mismatch", "claim");
      const account = wallet.account ?? await wallet.connect();
      if (account.address !== session.walletAddress) throw new ApiError(401, "wrong_wallet", "claim");
      const expiresAt = "status" in reservation && reservation.status === "reserved"
        ? BigInt(Math.floor(Date.parse(reservation.expiresAt) / 1000)) : undefined;
      const instruction = await claimInstruction(address(session.walletAddress), address(bounty), expiresAt);
      setPhase("Simulating…");
      if (await simulate(wallet.client.rpc, account.address, [instruction]) !== "ok") throw new ApiError(409, "simulation_failed", "claim");
      setPhase("Approve in your wallet…");
      await wallet.sendTransactions([instruction]);
      await waitUntilActive();
      setPhase(release ? "Confirming release…" : "Confirming acceptance…");
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          if (release) {
            if ((await releaseClaim(session, id)).released) return null;
          } else {
            return await confirmClaim(session, id);
          }
        } catch (cause) {
          if (!(cause instanceof ApiError) || cause.code !== "unconfirmed") throw cause;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      throw new ApiError(503, "unconfirmed", "claim");
    } finally {
      running.current = false;
      setPhase("");
    }
  };

  return { run, phase };
}
