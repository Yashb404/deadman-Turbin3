use anchor_lang::prelude::*;

use crate::state::VaultState;

#[derive(Accounts)]
pub struct UpdateInterval<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<UpdateInterval>, new_interval: i64) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.interval = new_interval;

    Ok(())
}
