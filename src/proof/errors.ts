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
  proof_already_submitted: "A proof has already been submitted. Return to the bounty to view its status.",
  chain_unavailable: "Solana is temporarily unavailable. Try again.",
  chain_protected: "Escrow protection is still confirming. Try again to check your saved photo.",
  review_not_configured: "Proof review is temporarily unavailable. Your reward remains locked.",
  unconfirmed: "Solana confirmation is still pending. Check the review again before retrying.",
};

export function proofMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Sign in again.";
    if (error.code && messages[error.code]) return messages[error.code];
  }
  return error instanceof CaptureError
    ? error.message
    : "Couldn’t connect to Scoutvy. Try again.";
}
