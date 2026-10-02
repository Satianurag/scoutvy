export type WalletFailure = "no_wallet" | "cancelled" | "closed" | "network" | "unknown";

const DECLINE_CODES = new Set<unknown>([-1, -3, "ERROR_AUTHORIZATION_FAILED"]);

// The wallet went away without answering: the user backed out, or the wallet app stopped.
const CLOSED_CODES = new Set<unknown>(["ERROR_ASSOCIATION_CANCELLED", "ERROR_SESSION_CLOSED", "ERROR_SESSION_TIMEOUT"]);

export function classifyWalletError(error: unknown): WalletFailure {
  if (!(error instanceof Error)) return "unknown";
  const code = "code" in error ? error.code : undefined;
  if (code === "ERROR_WALLET_NOT_FOUND") return "no_wallet";
  if (DECLINE_CODES.has(code) || /declin|reject/i.test(error.message)) return "cancelled";
  if (CLOSED_CODES.has(code) || /cancel/i.test(error.message)) return "closed";
  if (error instanceof TypeError || /network request failed/i.test(error.message)) return "network";
  return "unknown";
}

export const walletFailureMessage: Record<WalletFailure, string> = {
  no_wallet: "No Solana wallet found on this phone. Install one to continue.",
  cancelled: "Sign-in was cancelled in your wallet. Try again when you're ready.",
  closed: "Your wallet closed before signing in. Try again when you're ready.",
  network: "Couldn't reach Scoutvy. Check your connection and try again.",
  unknown: "Something went wrong while signing in. Please try again.",
};
