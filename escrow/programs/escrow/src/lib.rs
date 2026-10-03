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

    pub fn initialize_review(
        ctx: Context<InitializeReview>,
        attester: Pubkey,
        resolver: Pubkey,
    ) -> Result<()> {
        require!(
            attester != Pubkey::default() && resolver != Pubkey::default(),
            EscrowError::Unauthorized
        );
        ctx.accounts
            .config
            .set_inner(ReviewConfig { attester, resolver });
        Ok(())
    }

    pub fn accept_bounty(ctx: Context<AcceptBounty>, expires_at: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require_keys_neq!(
            ctx.accounts.scout.key(),
            ctx.accounts.bounty.poster,
            EscrowError::WrongRecipient
        );
        require!(
            expires_at > now
                && expires_at <= ctx.accounts.bounty.expires_at,
            EscrowError::InvalidExpiry
        );
        let claim = &mut ctx.accounts.claim;
        if claim.expires_at > now {
            require_keys_eq!(
                claim.scout,
                ctx.accounts.scout.key(),
                EscrowError::ClaimTaken
            );
            return Ok(());
        }
        claim.set_inner(ScoutClaim {
            bounty: ctx.accounts.bounty.key(),
            scout: ctx.accounts.scout.key(),
            accepted_at: now,
            expires_at,
            bump: ctx.bumps.claim,
        });
        Ok(())
    }

    pub fn release_claim(ctx: Context<ReleaseClaim>) -> Result<()> {
        ctx.accounts.claim.expires_at = 0;
        Ok(())
    }

    pub fn attest_proof(ctx: Context<AttestProof>, scout: Pubkey, proof: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            now < ctx.accounts.bounty.expires_at,
            EscrowError::ReviewEnded
        );
        require_keys_eq!(scout, ctx.accounts.claim.scout, EscrowError::WrongRecipient);
        require!(
            now < ctx.accounts.claim.expires_at,
            EscrowError::ClaimExpired
        );
        require!(proof != [0; 32], EscrowError::InvalidDigest);
        let b = &ctx.accounts.bounty;
        ctx.accounts.review.set_inner(Review {
            bounty: b.key(),
            poster: b.poster,
            scout,
            mint: b.mint,
            amount: b.amount,
            proof,
            dispute: [0; 32],
            resolution: [0; 32],
            attested_at: now,
            deadline: now + 48 * 3600,
            decided_at: 0,
            status: 0,
            bump: ctx.bumps.review,
        });
        Ok(())
    }

    pub fn dispute_proof(ctx: Context<DisputeProof>, reason: [u8; 32]) -> Result<()> {
        require!(ctx.accounts.review.status == 0, EscrowError::InvalidState);
        require!(
            Clock::get()?.unix_timestamp < ctx.accounts.review.deadline,
            EscrowError::ReviewEnded
        );
        require!(reason != [0; 32], EscrowError::InvalidDigest);
        ctx.accounts.review.dispute = reason;
        ctx.accounts.review.status = 1;
        ctx.accounts.review.decided_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    pub fn approve_and_pay(ctx: Context<Settle>) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.signer.key(),
            ctx.accounts.review.poster,
            EscrowError::NotPoster
        );
        require!(ctx.accounts.review.status == 0, EscrowError::InvalidState);
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            ctx.accounts.review.scout,
            EscrowError::WrongRecipient
        );
        settle(ctx.accounts, 2, [0; 32])
    }

    pub fn release_unreviewed(ctx: Context<Settle>) -> Result<()> {
        require!(ctx.accounts.review.status == 0, EscrowError::InvalidState);
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.review.deadline,
            EscrowError::ReviewPending
        );
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            ctx.accounts.review.scout,
            EscrowError::WrongRecipient
        );
        settle(ctx.accounts, 2, [0; 32])
    }

    pub fn resolve_dispute(ctx: Context<Settle>, pay_scout: bool, reason: [u8; 32]) -> Result<()> {
        require_keys_eq!(
            ctx.accounts.signer.key(),
            ctx.accounts.config.resolver,
            EscrowError::Unauthorized
        );
        require!(ctx.accounts.review.status == 1, EscrowError::InvalidState);
        require!(reason != [0; 32], EscrowError::InvalidDigest);
        let recipient = if pay_scout {
            ctx.accounts.review.scout
        } else {
            ctx.accounts.review.poster
        };
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            recipient,
            EscrowError::WrongRecipient
        );
        settle(ctx.accounts, if pay_scout { 2 } else { 3 }, reason)
    }

    pub fn create_bounty(
        ctx: Context<CreateBounty>,
        id: [u8; 16],
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
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
        require_keys_eq!(
            ctx.accounts.signer.key(),
            ctx.accounts.bounty.poster,
            EscrowError::NotPoster
        );
        refund(ctx.accounts)
    }

    pub fn refund_expired(ctx: Context<Refund>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(
            now >= ctx.accounts.bounty.expires_at,
            EscrowError::NotExpired
        );
        refund(ctx.accounts)
    }
}

fn refund(accounts: &mut Refund) -> Result<()> {
    require!(accounts.review.data_is_empty(), EscrowError::Protected);
    let bounty = &accounts.bounty;
    let seeds: &[&[u8]] = &[
        BOUNTY_SEED,
        bounty.poster.as_ref(),
        &bounty.id,
        &[bounty.bump],
    ];
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

fn settle(accounts: &mut Settle, status: u8, reason: [u8; 32]) -> Result<()> {
    require!(
        accounts.vault.amount >= accounts.bounty.amount,
        EscrowError::InvalidState
    );
    let b = &accounts.bounty;
    let seeds: &[&[u8]] = &[BOUNTY_SEED, b.poster.as_ref(), &b.id, &[b.bump]];
    let signer = &[seeds];
    token::transfer_checked(
        CpiContext::new_with_signer(
            Token::id(),
            TransferChecked {
                from: accounts.vault.to_account_info(),
                mint: accounts.mint.to_account_info(),
                to: accounts.recipient_token.to_account_info(),
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
    ))?;
    accounts.review.status = status;
    accounts.review.resolution = reason;
    accounts.review.decided_at = Clock::get()?.unix_timestamp;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeReview<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(constraint = program.programdata_address()? == Some(program_data.key()))]
    pub program: Program<'info, crate::program::Escrow>,
    #[account(constraint = program_data.upgrade_authority_address == Some(authority.key()))]
    pub program_data: Account<'info, ProgramData>,
    #[account(init, payer = authority, space = 8 + ReviewConfig::INIT_SPACE, seeds = [b"review_config"], bump)]
    pub config: Account<'info, ReviewConfig>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AcceptBounty<'info> {
    #[account(mut)]
    pub scout: Signer<'info>,
    #[account(seeds = [BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id], bump = bounty.bump)]
    pub bounty: Account<'info, Bounty>,
    #[account(init_if_needed, payer = scout, space = 8 + ScoutClaim::INIT_SPACE,
        seeds = [b"claim", bounty.key().as_ref()], bump)]
    pub claim: Account<'info, ScoutClaim>,
    /// CHECK: the canonical receipt prevents replacing a protected claim.
    #[account(seeds = [b"review", bounty.key().as_ref()], bump,
        constraint = review.data_is_empty() @ EscrowError::Protected)]
    pub review: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReleaseClaim<'info> {
    pub scout: Signer<'info>,
    /// CHECK: used only as the canonical seed; no bounty data is read.
    pub bounty: UncheckedAccount<'info>,
    #[account(mut, seeds = [b"claim", bounty.key().as_ref()], bump = claim.bump,
        has_one = scout, has_one = bounty)]
    pub claim: Account<'info, ScoutClaim>,
    /// CHECK: a protected claim cannot be released.
    #[account(seeds = [b"review", bounty.key().as_ref()], bump,
        constraint = review.data_is_empty() @ EscrowError::Protected)]
    pub review: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct AttestProof<'info> {
    #[account(mut, address = config.attester @ EscrowError::Unauthorized)]
    pub attester: Signer<'info>,
    #[account(seeds = [b"review_config"], bump)]
    pub config: Account<'info, ReviewConfig>,
    #[account(seeds = [BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id], bump = bounty.bump)]
    pub bounty: Account<'info, Bounty>,
    #[account(seeds = [b"claim", bounty.key().as_ref()], bump = claim.bump, has_one = bounty)]
    pub claim: Account<'info, ScoutClaim>,
    #[account(init, payer = attester, space = 8 + Review::INIT_SPACE, seeds = [b"review", bounty.key().as_ref()], bump)]
    pub review: Account<'info, Review>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisputeProof<'info> {
    pub poster: Signer<'info>,
    #[account(seeds = [BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id], bump = bounty.bump, has_one = poster)]
    pub bounty: Account<'info, Bounty>,
    #[account(mut, seeds = [b"review", bounty.key().as_ref()], bump = review.bump, has_one = bounty, has_one = poster)]
    pub review: Account<'info, Review>,
}

#[derive(Accounts)]
pub struct Settle<'info> {
    pub signer: Signer<'info>,
    #[account(seeds = [b"review_config"], bump)]
    pub config: Account<'info, ReviewConfig>,
    /// CHECK: rent is returned only to the funded bounty's poster.
    #[account(mut, address = bounty.poster)]
    pub poster: UncheckedAccount<'info>,
    pub mint: Account<'info, Mint>,
    /// CHECK: the instruction restricts the recipient to the stored scout or poster.
    pub recipient: UncheckedAccount<'info>,
    #[account(mut, token::mint = mint, token::authority = recipient)]
    pub recipient_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, close = poster, has_one = poster, has_one = mint,
        seeds = [BOUNTY_SEED, bounty.poster.as_ref(), &bounty.id], bump = bounty.bump)]
    pub bounty: Box<Account<'info, Bounty>>,
    #[account(mut, associated_token::mint = mint, associated_token::authority = bounty)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [b"review", bounty.key().as_ref()], bump = review.bump,
        has_one = bounty, has_one = poster, has_one = mint, constraint = review.amount == bounty.amount)]
    pub review: Box<Account<'info, Review>>,
    pub token_program: Program<'info, Token>,
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
    /// CHECK: a permanent review receipt prevents reusing a settled bounty id.
    #[account(seeds = [b"review", bounty.key().as_ref()], bump, constraint = review.data_is_empty() @ EscrowError::Protected)]
    pub review: UncheckedAccount<'info>,
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
    /// CHECK: canonical review PDA; a nonempty account protects submitted evidence.
    #[account(seeds = [b"review", bounty.key().as_ref()], bump)]
    pub review: UncheckedAccount<'info>,
}
