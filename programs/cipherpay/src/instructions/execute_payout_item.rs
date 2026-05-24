use anchor_lang::prelude::*;

use crate::{
    errors::CipherpayError,
    events::PayoutItemExecuted,
    state::{PayoutItem, PayoutReceipt, PayoutRun, PayoutRunStatus, Treasury},
};

pub const MAX_BATCH_ITEMS: usize = 8;

#[derive(Accounts)]
#[instruction(item_index: u32)]
pub struct ExecutePayoutItem<'info> {
    #[account(mut)]
    pub executor: Signer<'info>,
    #[account(
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Account<'info, Treasury>,
    #[account(
        mut,
        has_one = treasury,
        seeds = [PayoutRun::SEED_PREFIX, treasury.key().as_ref(), &payout_run.run_number.to_le_bytes()],
        bump = payout_run.bump
    )]
    pub payout_run: Account<'info, PayoutRun>,
    #[account(
        mut,
        seeds = [PayoutItem::SEED_PREFIX, payout_run.key().as_ref(), &item_index.to_le_bytes()],
        bump = payout_item.bump
    )]
    pub payout_item: Account<'info, PayoutItem>,
    /// CHECK: The recipient is pinned in the payout item and only receives lamports.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init,
        payer = executor,
        space = 8 + PayoutReceipt::INIT_SPACE,
        seeds = [PayoutReceipt::SEED_PREFIX, payout_run.key().as_ref(), &item_index.to_le_bytes()],
        bump
    )]
    pub payout_receipt: Account<'info, PayoutReceipt>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecutePayoutItem>, item_index: u32) -> Result<()> {
    require!(!ctx.accounts.treasury.paused, CipherpayError::TreasuryPaused);

    let clock = Clock::get()?;
    execute_item(
        &ctx.accounts.treasury,
        &mut ctx.accounts.payout_run,
        &mut ctx.accounts.payout_item,
        &ctx.accounts.recipient.to_account_info(),
        &mut ctx.accounts.payout_receipt,
        item_index,
        ctx.bumps.payout_receipt,
        clock,
    )
}

pub(crate) fn execute_item<'info>(
    treasury: &Account<'info, Treasury>,
    payout_run: &mut Account<'info, PayoutRun>,
    payout_item: &mut Account<'info, PayoutItem>,
    recipient: &AccountInfo<'info>,
    payout_receipt: &mut Account<'info, PayoutReceipt>,
    item_index: u32,
    receipt_bump: u8,
    clock: Clock,
) -> Result<()> {
    validate_item_execution(treasury, payout_run, payout_item, recipient, item_index)?;
    transfer_from_run_escrow(&payout_run.to_account_info(), recipient, payout_item.lamports)?;

    payout_item.executed = true;
    payout_item.executed_at = clock.unix_timestamp;
    payout_item.executed_slot = clock.slot;

    payout_receipt.treasury = treasury.key();
    payout_receipt.run = payout_run.key();
    payout_receipt.item = payout_item.key();
    payout_receipt.run_number = payout_run.run_number;
    payout_receipt.item_index = item_index;
    payout_receipt.authority = payout_run.authority;
    payout_receipt.recipient = payout_item.recipient;
    payout_receipt.lamports = payout_item.lamports;
    payout_receipt.executed_at = clock.unix_timestamp;
    payout_receipt.executed_slot = clock.slot;
    payout_receipt.bump = receipt_bump;

    mark_run_execution(payout_run, payout_item.lamports, clock.unix_timestamp)?;

    emit!(PayoutItemExecuted {
        treasury: treasury.key(),
        run: payout_run.key(),
        item: payout_item.key(),
        receipt: payout_receipt.key(),
        item_index,
        recipient: payout_item.recipient,
        lamports: payout_item.lamports,
    });

    Ok(())
}

pub(crate) fn validate_item_execution<'info>(
    treasury: &Account<'info, Treasury>,
    payout_run: &Account<'info, PayoutRun>,
    payout_item: &Account<'info, PayoutItem>,
    recipient: &AccountInfo<'info>,
    item_index: u32,
) -> Result<()> {
    payout_run.assert_executable()?;
    require!(
        payout_run.treasury == treasury.key(),
        CipherpayError::InvalidPayoutItem
    );
    require!(
        item_index < payout_run.expected_item_count,
        CipherpayError::ItemIndexOutOfRange
    );
    require!(
        payout_item.run == payout_run.key() && payout_item.item_index == item_index,
        CipherpayError::InvalidPayoutItem
    );
    require!(!payout_item.executed, CipherpayError::PayoutItemAlreadyExecuted);
    require!(
        recipient.key() == payout_item.recipient,
        CipherpayError::RecipientMismatch
    );

    Ok(())
}

pub(crate) fn transfer_from_run_escrow<'info>(
    payout_run_info: &AccountInfo<'info>,
    recipient: &AccountInfo<'info>,
    lamports: u64,
) -> Result<()> {
    require!(lamports > 0, CipherpayError::InvalidPayoutAmount);

    let rent = Rent::get()?;
    let run_rent = rent.minimum_balance(8 + PayoutRun::INIT_SPACE);
    let spendable = payout_run_info
        .lamports()
        .checked_sub(run_rent)
        .ok_or(error!(CipherpayError::EscrowInsufficient))?;
    require!(spendable >= lamports, CipherpayError::EscrowInsufficient);

    **payout_run_info.try_borrow_mut_lamports()? = payout_run_info
        .lamports()
        .checked_sub(lamports)
        .ok_or(error!(CipherpayError::EscrowInsufficient))?;
    **recipient.try_borrow_mut_lamports()? = recipient
        .lamports()
        .checked_add(lamports)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;

    Ok(())
}

pub(crate) fn mark_run_execution(
    payout_run: &mut Account<PayoutRun>,
    lamports: u64,
    now: i64,
) -> Result<()> {
    let next_item_count = payout_run
        .executed_item_count
        .checked_add(1)
        .ok_or(error!(CipherpayError::RunItemCountExceeded))?;
    let next_lamports = payout_run
        .executed_lamports
        .checked_add(lamports)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;

    require!(
        next_item_count <= payout_run.expected_item_count,
        CipherpayError::RunItemCountExceeded
    );
    require!(
        next_lamports <= payout_run.total_lamports,
        CipherpayError::EscrowInsufficient
    );

    payout_run.executed_item_count = next_item_count;
    payout_run.executed_lamports = next_lamports;
    payout_run.touch(now);
    payout_run.status = if next_item_count == payout_run.expected_item_count {
        require!(
            next_lamports == payout_run.total_lamports,
            CipherpayError::EscrowInsufficient
        );
        payout_run.completed_at = now;
        PayoutRunStatus::Completed
    } else {
        PayoutRunStatus::InProgress
    };

    Ok(())
}
