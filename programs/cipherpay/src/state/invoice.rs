use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Invoice{
    pub creator: Pubkey,
    pub creator_account_bump: u8,
    pub client: Pubkey,
    pub client_account_bump: u8,
    pub amount: u64,
    pub paid: bool,
    pub created_at: i64,
    pub bump: u8,
}