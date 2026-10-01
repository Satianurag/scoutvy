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
