use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PayoutReceipt {
    pub treasury: Pubkey,
    pub run: Pubkey,
    pub run_number: u64,
    pub item_index: u32,
    pub authority: Pubkey,
    pub recipient: Pubkey,
    pub recipient_token_account: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub executed_at: i64,
    pub executed_slot: u64,
    pub bump: u8,
}

impl PayoutReceipt {
    pub const SEED_PREFIX: &'static [u8] = b"receipt";
}
