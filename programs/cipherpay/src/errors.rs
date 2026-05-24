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
    #[msg("Manifest hash must not be all zeroes.")]
    ManifestHashRequired,
    #[msg("The payout item index is out of range for this run.")]
    ItemIndexOutOfRange,
    #[msg("The payout run must be in Draft status.")]
    RunNotDraft,
    #[msg("The payout run must be funded before execution.")]
    RunNotFunded,
    #[msg("This payout run can no longer accept executions.")]
    RunNotExecutable,
    #[msg("This payout run has already been cancelled.")]
    RunAlreadyCancelled,
    #[msg("This payout run has already been completed.")]
    RunAlreadyCompleted,
    #[msg("This payout run cannot be cancelled in its current state.")]
    RunNotCancellable,
    #[msg("This payout run must be cancelled first.")]
    RunNotCancelled,
    #[msg("Recipient cannot be the default public key.")]
    InvalidRecipient,
    #[msg("Creating this payout item would exceed the run total.")]
    RunItemSumExceeded,
    #[msg("All payout items must be created before funding.")]
    RunItemsIncomplete,
    #[msg("Created payout item lamports must equal the run total before funding.")]
    RunItemSumMismatch,
    #[msg("This payout run has already been funded.")]
    RunAlreadyFunded,
    #[msg("Executing this item would exceed the run item count.")]
    RunItemCountExceeded,
    #[msg("The payout item account does not match this run and index.")]
    InvalidPayoutItem,
    #[msg("Recipient account does not match the payout item recipient.")]
    RecipientMismatch,
    #[msg("Payout item has already been executed.")]
    PayoutItemAlreadyExecuted,
    #[msg("Receipt account PDA does not match this run and item index.")]
    ReceiptPdaMismatch,
    #[msg("The payout run escrow does not have enough spendable lamports.")]
    EscrowInsufficient,
    #[msg("No refundable escrow lamports are available.")]
    NoRefundAvailable,
    #[msg("Batch must contain at least one payout item.")]
    InvalidBatchSize,
    #[msg("Batch exceeds the maximum safe payout item count.")]
    BatchTooLarge,
    #[msg("Batch remaining accounts must be exactly item, recipient, receipt for each index.")]
    InvalidRemainingAccounts,
    #[msg("Batch contains a duplicate payout item index.")]
    DuplicateBatchItem,
    #[msg("Rent-exempt reserve calculation failed.")]
    RentExemptionCalculationFailed,
    #[msg("Arithmetic overflow.")]
    ArithmeticOverflow,
}
