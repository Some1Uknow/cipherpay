use anchor_lang::prelude::*;

#[event]
pub struct TreasuryInitialized {
    pub treasury: Pubkey,
    pub authority: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct TreasuryPauseUpdated {
    pub treasury: Pubkey,
    pub paused: bool,
}

#[event]
pub struct PayoutRunCreated {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
    pub expected_item_count: u32,
    pub total_amount: u64,
    pub manifest_hash: [u8; 32],
}

#[event]
pub struct PayoutItemExecuted {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub receipt: Pubkey,
    pub item_index: u32,
    pub recipient: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PayoutRunCancelled {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
}
