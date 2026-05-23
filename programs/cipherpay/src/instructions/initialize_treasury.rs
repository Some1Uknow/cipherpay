use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::{
    events::TreasuryInitialized,
    state::Treasury,
};

#[derive(Accounts)]
pub struct InitializeTreasury<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = authority,
        space = 8 + Treasury::INIT_SPACE,
        seeds = [Treasury::SEED_PREFIX, authority.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub treasury: Account<'info, Treasury>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeTreasury>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let treasury = &mut ctx.accounts.treasury;

    treasury.authority = ctx.accounts.authority.key();
    treasury.mint = ctx.accounts.mint.key();
    treasury.bump = ctx.bumps.treasury;
    treasury.paused = false;
    treasury.next_run_number = 0;
    treasury.created_at = now;
    treasury.updated_at = now;

    emit!(TreasuryInitialized {
        treasury: treasury.key(),
        authority: treasury.authority,
        mint: treasury.mint,
    });

    Ok(())
}
