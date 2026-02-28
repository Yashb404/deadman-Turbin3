use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount, Transfer};

use crate::state::VaultState;

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        close = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"token_vault", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelVault>) -> Result<()> {
    let vault_state = &ctx.accounts.vault_state;
    let amount = ctx.accounts.vault_token_account.amount;

    let owner_key = vault_state.owner;
    let bump = vault_state.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault", owner_key.as_ref(), &[bump]]];

    let transfer_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
    token::transfer(transfer_ctx, amount)?;

    let close_accounts = CloseAccount {
        account: ctx.accounts.vault_token_account.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
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
