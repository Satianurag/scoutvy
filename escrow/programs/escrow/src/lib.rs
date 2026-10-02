pub mod constants;
pub mod error;
pub mod state;

use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

pub use constants::*;
pub use error::EscrowError;
pub use state::*;

declare_id!("BJQ94FbDBxpVEbqao6caVvK89rouxWh3cmN2xJHrswWn");

#[program]
pub mod escrow {
    use super::*;

    pub fn create_bounty(ctx: Context<CreateBounty>, id: [u8; 16], amount: u64, expires_at: i64) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);
        let now = Clock::get()?.unix_timestamp;
        require!(
            expires_at >= now + MIN_DURATION && expires_at <= now + MAX_DURATION,
            EscrowError::InvalidExpiry
        );

        ctx.accounts.bounty.set_inner(Bounty {
            poster: ctx.accounts.poster.key(),
            mint: ctx.accounts.mint.key(),
            id,
            amount,
            created_at: now,
            expires_at,
            bump: ctx.bumps.bounty,
        });

        token::transfer_checked(
            CpiContext::new(
                Token::id(),
                TransferChecked {
                    from: ctx.accounts.poster_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.poster.to_account_info(),
                },
            ),
            amount,
            ctx.accounts.mint.decimals,
        )
    }

    pub fn cancel_bounty(ctx: Context<Refund>) -> Result<()> {
        require_keys_eq!(ctx.accounts.signer.key(), ctx.accounts.bounty.poster, EscrowError::NotPoster);
        refund(ctx.accounts)
    }

    pub fn refund_expired(ctx: Context<Refund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(now >= ctx.accounts.bounty.expires_at, EscrowError::NotExpired);
        refund(ctx.accounts)
    }
}

fn refund(accounts: &mut Refund) -> Result<()> {
    let bounty = &accounts.bounty;
    let seeds: &[&[u8]] = &[BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id, &[bounty.bump]];
    let signer = &[seeds];

    token::transfer_checked(
        CpiContext::new_with_signer(
            Token::id(),
            TransferChecked {
                from: accounts.vault.to_account_info(),
                mint: accounts.mint.to_account_info(),
                to: accounts.poster_token.to_account_info(),
                authority: accounts.bounty.to_account_info(),
            },
            signer,
        ),
        accounts.vault.amount,
        accounts.mint.decimals,
    )?;

    token::close_account(CpiContext::new_with_signer(
        Token::id(),
        CloseAccount {
            account: accounts.vault.to_account_info(),
            destination: accounts.poster.to_account_info(),
            authority: accounts.bounty.to_account_info(),
        },
        signer,
    ))
}

#[derive(Accounts)]
#[instruction(id: [u8; 16])]
pub struct CreateBounty<'info> {
    #[account(mut)]
    pub poster: Signer<'info>,
    #[account(constraint = ALLOWED_MINTS.contains(&mint.key()) @ EscrowError::UnsupportedMint)]
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = poster)]
    pub poster_token: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = poster,
        space = 8 + Bounty::INIT_SPACE,
        seeds = [BOUNTY_SEED, poster.key().as_ref(), &id],
        bump,
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(
        init,
        payer = poster,
        associated_token::mint = mint,
        associated_token::authority = bounty,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Refund<'info> {
    pub signer: Signer<'info>,
    /// CHECK: receives rent; must equal the bounty's poster.
    #[account(mut, address = bounty.poster)]
    pub poster: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    #[account(mut, token::mint = mint, token::authority = poster)]
    pub poster_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        close = poster,
        has_one = poster,
        has_one = mint,
        seeds = [BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id],
        bump = bounty.bump,
    )]
    pub bounty: Account<'info, Bounty>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = bounty)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}
