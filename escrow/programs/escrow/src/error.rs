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
}
