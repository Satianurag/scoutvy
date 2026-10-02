use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Reward amount must be greater than zero")]
    ZeroAmount,
    #[msg("Reward token is not supported")]
    UnsupportedMint,
    #[msg("Expiry is outside the allowed duration")]
    InvalidExpiry,
    #[msg("Only the poster can cancel this bounty")]
    NotPoster,
    #[msg("Bounty has not expired yet")]
    NotExpired,
    #[msg("Submitted evidence protects this escrow from cancellation")]
    Protected,
    #[msg("Invalid settlement state")]
    InvalidState,
    #[msg("Only the configured authority can perform this action")]
    Unauthorized,
    #[msg("Settlement recipient does not match the accepted scout or poster")]
    WrongRecipient,
    #[msg("Proof or decision digest is invalid")]
    InvalidDigest,
    #[msg("The review window has not ended")]
    ReviewPending,
    #[msg("The review window has ended")]
    ReviewEnded,
    #[msg("Another scout holds this claim")]
    ClaimTaken,
    #[msg("The scout claim has expired")]
    ClaimExpired,
}
