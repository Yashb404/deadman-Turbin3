use anchor_lang::prelude::*;

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
