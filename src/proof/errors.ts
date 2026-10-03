import { WalletTransactionError } from "@/wallet/use-wallet-transaction";
import { ApiError } from "@/auth/api";

export class CaptureError extends Error {}

const messages: Record<string, string> = {
  bounty_taken: "Another scout has accepted this bounty.",
  bounty_unavailable: "This bounty is no longer available.",
  claim_expired: "Your acceptance has expired. Return to the bounty to check availability.",
  capture_expired: "Your capture window has ended. Retake the photo.",
  stale_capture: "The photo and location must be captured together. Retake the photo.",
  mock_location: "Mock locations cannot be used for proof.",
  invalid_metadata: "A precise location is required. Move outdoors and retake the photo.",
  outside_radius: "You’re outside the proof radius. Go to the target and retake the photo.",
  image_too_large: "The photo is too large. Retake the photo.",
  invalid_image: "This photo couldn’t be processed. Retake the photo.",
  proof_already_submitted: "Work has already been submitted. Return to the bounty to view its status.",
  chain_unavailable: "Solana is temporarily unavailable. Try again.",
  chain_protected: "Confirmation is still pending. Try again to check your saved submission.",
  review_funding_unavailable: "Review is temporarily unavailable. Your submission is saved. Try again later.",
  review_not_configured: "Review is temporarily unavailable. Check again later.",
  unconfirmed: "Solana confirmation is still pending. Try again to check its status.",
  wrong_wallet: "Switch to the wallet you used to sign in.",
  no_devnet_sol:
    "Your wallet needs devnet SOL for network costs. Add devnet SOL, then continue your acceptance.",
  simulation_failed: "Solana couldn’t prepare this action. Check the bounty and try again.",
  wrong_proof_type: "Use the submission method chosen by the poster.",
  invalid_submission: "Your submission needs 10–5,000 characters.",
  chain_mismatch: "The on-chain bounty has changed. Return to the bounty to check its status.",
};

export function proofMessage(error: unknown) {
  if (error instanceof WalletTransactionError) return error.message;
  if (error instanceof ApiError) {
    if (error.code && messages[error.code]) return messages[error.code];
    if (error.status === 401) return "Reconnect your wallet, then try again. Your draft is saved.";
  }
  if (error instanceof Error && /reject|declin|cancel/i.test(error.message))
    return "Wallet approval was cancelled. You can try again.";
  return error instanceof CaptureError ? error.message : "Couldn’t connect to Scoutvy. Try again.";
}
