use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("The vault is still active. The interval and grace period have not passed yet.")]
    VaultStillActive,
    #[msg("Interval must be greater than zero.")]
    InvalidInterval,
    #[msg("Interval exceeds the maximum allowed duration.")]
    IntervalTooLarge,
    #[msg("Grace period must be greater than zero.")]
    InvalidGracePeriod,
    #[msg("Grace period exceeds the maximum allowed duration.")]
    GracePeriodTooLarge,
    #[msg("Beneficiary cannot be the default pubkey.")]
    InvalidBeneficiary,
    #[msg("Arithmetic overflow while computing unlock time.")]
    ArithmeticOverflow,
}
