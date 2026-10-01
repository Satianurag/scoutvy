export type WalletFailure = "no_wallet" | "cancelled" | "network" | "unknown";

const CANCEL_CODES = new Set<unknown>([
  -1,
  -3,
  "ERROR_ASSOCIATION_CANCELLED",
  "ERROR_SESSION_CLOSED",
  "ERROR_SESSION_TIMEOUT",
  "ERROR_AUTHORIZATION_FAILED",
]);

export function classifyWalletError(error: unknown): WalletFailure {
  if (!(error instanceof Error)) return "unknown";
  const code = "code" in error ? error.code : undefined;
  if (code === "ERROR_WALLET_NOT_FOUND") return "no_wallet";
  if (CANCEL_CODES.has(code) || /cancel|declin|reject/i.test(error.message)) return "cancelled";
  if (error instanceof TypeError || /network request failed/i.test(error.message)) return "network";
  return "unknown";
}

export const walletFailureMessage: Record<WalletFailure, string> = {
  no_wallet: "No Solana wallet found on this phone. Install one to continue.",
  cancelled: "Sign-in was cancelled in your wallet. Try again when you're ready.",
  network: "Couldn't reach Scoutvy. Check your connection and try again.",
  unknown: "Something went wrong while signing in. Please try again.",
};
