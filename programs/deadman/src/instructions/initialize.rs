use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::state::VaultState;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    /// CHECK: Beneficiary is only used to store the public key for future withdrawals
    pub beneficiary: AccountInfo<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = vault_state,
        seeds = [b"token_vault", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<Initialize>,
    interval: i64,
    grace_period: i64,
    deposit_amount: u64,
) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;

    vault_state.owner = ctx.accounts.owner.key();
    vault_state.beneficiary = ctx.accounts.beneficiary.key();
    vault_state.mint = ctx.accounts.mint.key();
    vault_state.interval = interval;
    vault_state.grace_period = grace_period;
    vault_state.last_ping_time = clock.unix_timestamp;
    vault_state.bump = ctx.bumps.vault_state;

    let cpi_accounts = Transfer {
        from: ctx.accounts.owner_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, deposit_amount)?;

    Ok(())
}
