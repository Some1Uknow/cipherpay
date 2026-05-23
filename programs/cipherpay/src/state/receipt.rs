use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Receipt{
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub paid_at: i64,
    pub bump: u8,
}