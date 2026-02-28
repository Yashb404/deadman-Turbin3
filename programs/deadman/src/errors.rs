use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The vault is still active. The interval and grace period have not passed yet.")]
    VaultStillActive,
}
