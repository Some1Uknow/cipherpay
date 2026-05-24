use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Treasury {
    pub authority: Pubkey,
    pub bump: u8,
    pub paused: bool,
    pub next_run_number: u64,
    pub created_at: i64,
    pub updated_at: i64,
}

impl Treasury {
    pub const SEED_PREFIX: &'static [u8] = b"treasury";

    pub fn touch(&mut self, now: i64) {
        self.updated_at = now;
    }
}
