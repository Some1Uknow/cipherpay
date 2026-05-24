use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PayoutItem {
    pub run: Pubkey,
    pub item_index: u32,
    pub recipient: Pubkey,
    pub lamports: u64,
    pub executed: bool,
    pub created_at: i64,
    pub executed_at: i64,
    pub executed_slot: u64,
    pub bump: u8,
}

impl PayoutItem {
    pub const SEED_PREFIX: &'static [u8] = b"item";
}
