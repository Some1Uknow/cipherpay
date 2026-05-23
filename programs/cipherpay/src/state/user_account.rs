use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserAccount{
    #[max_len(32)]
    pub name: String,
    pub total_received: u64,
    pub total_payed: u64,
    pub bump: u8,
}