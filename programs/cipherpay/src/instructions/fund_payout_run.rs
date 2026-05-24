use anchor_lang::{prelude::*, system_program};

use crate::{
    errors::CipherpayError,
    events::PayoutRunFunded,
    state::{PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
pub struct FundPayoutRun<'info> {
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
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<FundPayoutRun>) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, CipherpayError::TreasuryPaused);

    let payout_run = &mut ctx.accounts.payout_run;
    require!(payout_run.status == PayoutRunStatus::Draft, CipherpayError::RunNotDraft);
    require!(
        payout_run.created_item_count == payout_run.expected_item_count,
        CipherpayError::RunItemsIncomplete
    );
    require!(
        payout_run.created_lamports == payout_run.total_lamports,
        CipherpayError::RunItemSumMismatch
    );
    require!(
        payout_run.deposited_lamports == 0,
        CipherpayError::RunAlreadyFunded
    );
    let run_rent = Rent::get()?.minimum_balance(8 + PayoutRun::INIT_SPACE);
    let existing_escrow = payout_run
        .to_account_info()
        .lamports()
        .checked_sub(run_rent)
        .ok_or(error!(CipherpayError::EscrowInsufficient))?;
    require!(existing_escrow == 0, CipherpayError::RunAlreadyFunded);

    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.authority.to_account_info(),
                to: payout_run.to_account_info(),
            },
        ),
        payout_run.total_lamports,
    )?;

    let now = Clock::get()?.unix_timestamp;
    payout_run.deposited_lamports = payout_run.total_lamports;
    payout_run.status = PayoutRunStatus::Funded;
    payout_run.funded_at = now;
    payout_run.touch(now);
    treasury.touch(now);

    emit!(PayoutRunFunded {
        treasury: treasury.key(),
        run: payout_run.key(),
        run_number: payout_run.run_number,
        lamports: payout_run.total_lamports,
    });

    Ok(())
}
