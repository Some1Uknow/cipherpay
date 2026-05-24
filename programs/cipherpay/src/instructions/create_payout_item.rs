use anchor_lang::prelude::*;

use crate::{
    errors::CipherpayError,
    events::PayoutItemCreated,
    state::{PayoutItem, PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
#[instruction(item_index: u32)]
pub struct CreatePayoutItem<'info> {
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
    #[account(
        init,
        payer = authority,
        space = 8 + PayoutItem::INIT_SPACE,
        seeds = [PayoutItem::SEED_PREFIX, payout_run.key().as_ref(), &item_index.to_le_bytes()],
        bump
    )]
    pub payout_item: Account<'info, PayoutItem>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreatePayoutItem>,
    item_index: u32,
    recipient: Pubkey,
    lamports: u64,
) -> Result<()> {
    let treasury = &mut ctx.accounts.treasury;
    require!(!treasury.paused, CipherpayError::TreasuryPaused);
    require!(
        recipient != Pubkey::default(),
        CipherpayError::InvalidRecipient
    );
    require!(lamports > 0, CipherpayError::InvalidPayoutAmount);

    let payout_run = &mut ctx.accounts.payout_run;
    require!(payout_run.status == PayoutRunStatus::Draft, CipherpayError::RunNotDraft);
    require!(
        item_index < payout_run.expected_item_count,
        CipherpayError::ItemIndexOutOfRange
    );

    let next_item_count = payout_run
        .created_item_count
        .checked_add(1)
        .ok_or(error!(CipherpayError::RunItemCountExceeded))?;
    let next_lamports = payout_run
        .created_lamports
        .checked_add(lamports)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;

    require!(
        next_item_count <= payout_run.expected_item_count,
        CipherpayError::RunItemCountExceeded
    );
    require!(
        next_lamports <= payout_run.total_lamports,
        CipherpayError::RunItemSumExceeded
    );

    let now = Clock::get()?.unix_timestamp;
    let payout_item = &mut ctx.accounts.payout_item;
    payout_item.run = payout_run.key();
    payout_item.item_index = item_index;
    payout_item.recipient = recipient;
    payout_item.lamports = lamports;
    payout_item.executed = false;
    payout_item.created_at = now;
    payout_item.executed_at = 0;
    payout_item.executed_slot = 0;
    payout_item.bump = ctx.bumps.payout_item;

    payout_run.created_item_count = next_item_count;
    payout_run.created_lamports = next_lamports;
    payout_run.touch(now);
    treasury.touch(now);

    emit!(PayoutItemCreated {
        treasury: treasury.key(),
        run: payout_run.key(),
        item: payout_item.key(),
        item_index,
        recipient,
        lamports,
    });

    Ok(())
}
