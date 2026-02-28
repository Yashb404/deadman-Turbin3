use anchor_lang::prelude::*;

mod errors;
mod instructions;
mod state;

use instructions::*;

declare_id!("CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA");

#[program]
pub mod deadman {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        interval: i64,
        grace_period: i64,
        deposit_amount: u64,
    ) -> Result<()> {
        initialize::handler(ctx, interval, grace_period, deposit_amount)
    }

    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        ping::handler(ctx)
    }

    pub fn update_interval(ctx: Context<UpdateInterval>, new_interval: i64) -> Result<()> {
        update_interval::handler(ctx, new_interval)
    }

    pub fn update_beneficiary(
        ctx: Context<UpdateBeneficiary>,
        new_beneficiary: Pubkey,
    ) -> Result<()> {
        update_beneficiary::handler(ctx, new_beneficiary)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        deposit::handler(ctx, amount)
    }

    pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
        owner_withdraw::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        withdraw::handler(ctx)
    }

    pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
        cancel_vault::handler(ctx)
    }
}