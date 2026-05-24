use anchor_lang::prelude::*;

#[event]
pub struct TreasuryInitialized {
    pub treasury: Pubkey,
    pub authority: Pubkey,
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
    pub total_lamports: u64,
    pub manifest_hash: [u8; 32],
}

#[event]
pub struct PayoutItemCreated {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub item: Pubkey,
    pub item_index: u32,
    pub recipient: Pubkey,
    pub lamports: u64,
}

#[event]
pub struct PayoutRunFunded {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
    pub lamports: u64,
}

#[event]
pub struct PayoutItemExecuted {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub item: Pubkey,
    pub receipt: Pubkey,
    pub item_index: u32,
    pub recipient: Pubkey,
    pub lamports: u64,
}

#[event]
pub struct PayoutRunCancelled {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
}

#[event]
pub struct PayoutRunRefunded {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
    pub lamports: u64,
}
