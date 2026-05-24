use anchor_lang::prelude::*;

use crate::{
    errors::CipherpayError,
    events::PayoutRunRefunded,
    state::{PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
pub struct RefundPayoutRun<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        mut,
        has_one = treasury,
        has_one = authority,
        seeds = [PayoutRun::SEED_PREFIX, treasury.key().as_ref(), &payout_run.run_number.to_le_bytes()],
        bump = payout_run.bump
    )]
    pub payout_run: Account<'info, PayoutRun>,
}

pub fn handler(ctx: Context<RefundPayoutRun>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, CipherpayError::TreasuryPaused);

    let payout_run = &mut ctx.accounts.payout_run;
    require!(
        payout_run.status == PayoutRunStatus::Cancelled,
        CipherpayError::RunNotCancelled
    );

    let rent = Rent::get()?;
    let run_rent = rent.minimum_balance(8 + PayoutRun::INIT_SPACE);
    let refundable = payout_run
        .to_account_info()
        .lamports()
        .checked_sub(run_rent)
        .ok_or(error!(CipherpayError::NoRefundAvailable))?;
    require!(refundable > 0, CipherpayError::NoRefundAvailable);

    **payout_run.to_account_info().try_borrow_mut_lamports()? = payout_run
        .to_account_info()
        .lamports()
        .checked_sub(refundable)
        .ok_or(error!(CipherpayError::NoRefundAvailable))?;
    **ctx
        .accounts
        .authority
        .to_account_info()
        .try_borrow_mut_lamports()? = ctx
        .accounts
        .authority
        .to_account_info()
        .lamports()
        .checked_add(refundable)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;

    let now = Clock::get()?.unix_timestamp;
    payout_run.refunded_lamports = payout_run
        .refunded_lamports
        .checked_add(refundable)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;
    payout_run.touch(now);
    treasury.touch(now);

    emit!(PayoutRunRefunded {
        treasury: treasury.key(),
        run: payout_run.key(),
        run_number: payout_run.run_number,
        lamports: refundable,
    });

    Ok(())
}
