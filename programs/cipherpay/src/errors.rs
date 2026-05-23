use anchor_lang::prelude::*;

#[error_code]
pub enum CipherpayError {
    #[msg("Only the configured treasury authority can perform this action.")]
    UnauthorizedAuthority,
    #[msg("The treasury is paused.")]
    TreasuryPaused,
    #[msg("Run number does not match the treasury sequence.")]
    InvalidRunNumber,
    #[msg("Expected item count must be greater than zero.")]
    InvalidExpectedItemCount,
    #[msg("Total amount must be greater than zero.")]
    InvalidTotalAmount,
    #[msg("Payout amount must be greater than zero.")]
    InvalidPayoutAmount,
    #[msg("The provided mint does not match the treasury or payout run.")]
    MintMismatch,
    #[msg("The payout item index is out of range for this run.")]
    ItemIndexOutOfRange,
    #[msg("This payout run can no longer accept executions.")]
    RunNotExecutable,
    #[msg("This payout run has already been cancelled.")]
    RunAlreadyCancelled,
    #[msg("This payout run has already been completed.")]
    RunAlreadyCompleted,
    #[msg("Executing this item would exceed the run total.")]
    RunAmountExceeded,
    #[msg("Executing this item would exceed the run item count.")]
    RunItemCountExceeded,
    #[msg("The final executed amount must match the run total exactly.")]
    FinalRunAmountMismatch,
    #[msg("The run total cannot be reached before the final item is executed.")]
    RunCompletedTooEarly,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
