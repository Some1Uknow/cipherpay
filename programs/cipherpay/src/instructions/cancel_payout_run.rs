use anchor_lang::prelude::*;

use crate::{
    errors::CipherpayError,
    events::PayoutRunCancelled,
    state::{PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
pub struct CancelPayoutRun<'info> {
    pub authority: Signer<'info>,
    #[account(
        has_one = authority,
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref(), treasury.mint.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        mut,
        has_one = treasury,
        has_one = authority,
        seeds = [PayoutRun::SEED_PREFIX, treasury.key().as_ref(), &payout_run.run_number.to_le_bytes()],
        bump
    )]
    pub payout_run: Account<'info, PayoutRun>,
}

pub fn handler(ctx: Context<CancelPayoutRun>) -> Result<()> {
    let payout_run = &mut ctx.accounts.payout_run;
    match payout_run.status {
        PayoutRunStatus::Completed => return err!(CipherpayError::RunAlreadyCompleted),
        PayoutRunStatus::Cancelled => return err!(CipherpayError::RunAlreadyCancelled),
        PayoutRunStatus::Draft | PayoutRunStatus::InProgress => {}
    }

    let now = Clock::get()?.unix_timestamp;
    payout_run.status = PayoutRunStatus::Cancelled;
    payout_run.cancelled_at = now;
    payout_run.touch(now);

    emit!(PayoutRunCancelled {
        treasury: ctx.accounts.treasury.key(),
        run: payout_run.key(),
        run_number: payout_run.run_number,
    });

    Ok(())
}
