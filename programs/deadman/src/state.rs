use anchor_lang::prelude::*;

pub const MAX_INTERVAL_SECONDS: i64 = 315_360_000; // 10 years
pub const MAX_GRACE_PERIOD_SECONDS: i64 = 315_360_000; // 10 years

#[account]
pub struct VaultState {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub interval: i64,
    pub grace_period: i64,
    pub last_ping_time: i64,
    pub bump: u8,
}
