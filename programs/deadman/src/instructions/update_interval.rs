use anchor_lang::prelude::*;

use crate::errors::ErrorCode;
use crate::state::{VaultState, MAX_INTERVAL_SECONDS};

#[derive(Accounts)]
pub struct UpdateInterval<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"vault", owner.key().as_ref(), vault_state.mint.as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
}

pub fn handler(ctx: Context<UpdateInterval>, new_interval: i64) -> Result<()> {
    require!(new_interval > 0, ErrorCode::InvalidInterval);
    require!(new_interval <= MAX_INTERVAL_SECONDS, ErrorCode::IntervalTooLarge);

    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.interval = new_interval;

    Ok(())
}
