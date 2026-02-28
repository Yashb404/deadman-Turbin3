 use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::errors::ErrorCode;
use crate::state::VaultState;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        has_one = beneficiary,
        close = beneficiary,
        seeds = [b"vault", vault_state.owner.as_ref(), vault_state.mint.as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"token_vault", vault_state.owner.as_ref(), vault_state.mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = beneficiary_token_account.mint == vault_state.mint,
        constraint = beneficiary_token_account.owner == beneficiary.key()
    )]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    let clock = Clock::get()?;
    let unlock_time = vault_state
        .last_ping_time
        .checked_add(vault_state.interval)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_add(vault_state.grace_period)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    require!(
        clock.unix_timestamp > unlock_time,
        ErrorCode::VaultStillActive
    );

    let amount = ctx.accounts.vault_token_account.amount;

    let owner_key = vault_state.owner;
    let mint_key = vault_state.mint;
    let bump = vault_state.bump;
    let signer_seeds: &[&[&[u8]]] =
        &[&[b"vault", owner_key.as_ref(), mint_key.as_ref(), &[bump]]];

    let transfer_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.beneficiary_token_account.to_account_info(),
        authority: vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
    token::transfer(transfer_ctx, amount)?;

    let close_accounts = CloseAccount {
        account: ctx.accounts.vault_token_account.to_account_info(),
        destination: ctx.accounts.beneficiary.to_account_info(),
        authority: vault_state.to_account_info(),
    };
    let close_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        close_accounts,
        signer_seeds,
    );
    token::close_account(close_ctx)?;

    Ok(())
}
