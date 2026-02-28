use anchor_lang::prelude::*;

use crate::state::VaultState;

#[derive(Accounts)]
pub struct UpdateBeneficiary<'info> {
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

pub fn handler(ctx: Context<UpdateBeneficiary>, new_beneficiary: Pubkey) -> Result<()> {
    let vault_state = &mut ctx.accounts.vault_state;
    vault_state.beneficiary = new_beneficiary;

    Ok(())
}
