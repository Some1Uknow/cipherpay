use anchor_lang::prelude::*;

use crate::{
    errors::CipherpayError,
    events::PayoutRunCreated,
    state::{PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
#[instruction(run_number: u64)]
pub struct CreatePayoutRun<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref(), treasury.mint.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        init,
        payer = authority,
        space = 8 + PayoutRun::INIT_SPACE,
        seeds = [PayoutRun::SEED_PREFIX, treasury.key().as_ref(), &run_number.to_le_bytes()],
        bump
    )]
    pub payout_run: Account<'info, PayoutRun>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreatePayoutRun>,
    run_number: u64,
    expected_item_count: u32,
    total_amount: u64,
    manifest_hash: [u8; 32],
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, CipherpayError::TreasuryPaused);
    require!(
        run_number == treasury.next_run_number,
        CipherpayError::InvalidRunNumber
    );
    require!(
        expected_item_count > 0,
        CipherpayError::InvalidExpectedItemCount
    );
    require!(total_amount > 0, CipherpayError::InvalidTotalAmount);

    let now = Clock::get()?.unix_timestamp;
    let payout_run = &mut ctx.accounts.payout_run;
    payout_run.treasury = treasury.key();
    payout_run.authority = treasury.authority;
    payout_run.mint = treasury.mint;
    payout_run.run_number = run_number;
    payout_run.manifest_hash = manifest_hash;
    payout_run.status = PayoutRunStatus::Draft;
    payout_run.expected_item_count = expected_item_count;
    payout_run.executed_item_count = 0;
    payout_run.total_amount = total_amount;
    payout_run.executed_amount = 0;
    payout_run.created_at = now;
    payout_run.updated_at = now;
    payout_run.completed_at = 0;
    payout_run.cancelled_at = 0;

    treasury.next_run_number = treasury
        .next_run_number
        .checked_add(1)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;
    treasury.touch(now);

    emit!(PayoutRunCreated {
        treasury: treasury.key(),
        run: payout_run.key(),
        run_number,
        expected_item_count,
        total_amount,
        manifest_hash,
    });

    Ok(())
}
