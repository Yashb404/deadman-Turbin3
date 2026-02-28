use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::VaultState;

#[derive(Accounts)]
pub struct OwnerWithdraw<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        has_one = owner,
        seeds = [b"vault", owner.key().as_ref(), vault_state.mint.as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"token_vault", owner.key().as_ref(), vault_state.mint.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = owner_token_account.mint == vault_state.mint,
        constraint = owner_token_account.owner == owner.key()
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
    let vault_state = &ctx.accounts.vault_state;

    let owner_key = vault_state.owner;
    let mint_key = vault_state.mint;
    let bump = vault_state.bump;
    let signer_seeds: &[&[&[u8]]] =
        &[&[b"vault", owner_key.as_ref(), mint_key.as_ref(), &[bump]]];

    let transfer_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.owner_token_account.to_account_info(),
        authority: vault_state.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
    token::transfer(transfer_ctx, amount)?;

    Ok(())
}
