use anchor_lang::prelude::*;

use crate::{
    events::TreasuryInitialized,
    state::Treasury,
};

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [Treasury::SEED_PREFIX, authority.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeTreasury>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let treasury = &mut ctx.accounts.treasury;

    treasury.authority = ctx.accounts.authority.key();
    treasury.bump = ctx.bumps.treasury;
    treasury.paused = false;
    treasury.next_run_number = 0;
    treasury.created_at = now;
    treasury.updated_at = now;

    emit!(TreasuryInitialized {
        treasury: treasury.key(),
        authority: treasury.authority,
    });

    Ok(())
}
