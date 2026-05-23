use anchor_lang::prelude::*;

use crate::errors::CipherpayError;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum PayoutRunStatus {
    Draft,
    InProgress,
    Completed,
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct PayoutRun {
    pub treasury: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub run_number: u64,
    pub manifest_hash: [u8; 32],
    pub status: PayoutRunStatus,
    pub expected_item_count: u32,
    pub executed_item_count: u32,
    pub total_amount: u64,
    pub executed_amount: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: i64,
    pub cancelled_at: i64,
}

impl PayoutRun {
    pub const SEED_PREFIX: &'static [u8] = b"run";

    pub fn assert_executable(&self) -> Result<()> {
        match self.status {
            PayoutRunStatus::Draft | PayoutRunStatus::InProgress => Ok(()),
            PayoutRunStatus::Completed => err!(CipherpayError::RunAlreadyCompleted),
            PayoutRunStatus::Cancelled => err!(CipherpayError::RunAlreadyCancelled),
        }
    }

    pub fn touch(&mut self, now: i64) {
        self.updated_at = now;
    }
}
