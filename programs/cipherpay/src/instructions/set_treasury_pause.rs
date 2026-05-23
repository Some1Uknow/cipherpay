use anchor_lang::prelude::*;

use crate::{
    events::TreasuryPauseUpdated,
    state::Treasury,
};

#[derive(Accounts)]
pub struct SetTreasuryPause<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref(), treasury.mint.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
}

pub fn handler(ctx: Context<SetTreasuryPause>, paused: bool) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    treasury.paused = paused;
    treasury.touch(Clock::get()?.unix_timestamp);

    emit!(TreasuryPauseUpdated {
        treasury: treasury.key(),
        paused,
    });

    Ok(())
}
