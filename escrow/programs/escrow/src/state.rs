use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bounty {
    pub poster: Pubkey,
    pub mint: Pubkey,
    pub id: [u8; 16],
    pub amount: u64,
    pub created_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ScoutClaim {
    pub bounty: Pubkey,
    pub scout: Pubkey,
    pub accepted_at: i64,
    pub expires_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct ReviewConfig {
    pub attester: Pubkey,
    pub resolver: Pubkey,
}

#[account]
#[derive(InitSpace)]
pub struct Review {
    pub bounty: Pubkey,
    pub poster: Pubkey,
    pub scout: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub proof: [u8; 32],
    pub dispute: [u8; 32],
    pub resolution: [u8; 32],
    pub attested_at: i64,
    pub deadline: i64,
    pub decided_at: i64,
    pub status: u8,
    pub bump: u8,
}
