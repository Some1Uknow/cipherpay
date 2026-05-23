use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked},
};

use crate::{
    errors::CipherpayError,
    events::PayoutItemExecuted,
    state::{PayoutReceipt, PayoutRun, PayoutRunStatus, Treasury},
};

#[derive(Accounts)]
#[instruction(item_index: u32)]
pub struct ExecutePayoutItem<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        mut,
        has_one = authority,
        seeds = [Treasury::SEED_PREFIX, treasury.authority.as_ref(), treasury.mint.as_ref()],
        bump = treasury.bump
    )]
    pub treasury: Box<Account<'info, Treasury>>,
    #[account(
        mut,
        has_one = treasury,
        has_one = authority,
        constraint = payout_run.mint == mint.key() @ CipherpayError::MintMismatch,
        seeds = [PayoutRun::SEED_PREFIX, treasury.key().as_ref(), &payout_run.run_number.to_le_bytes()],
        bump
    )]
    pub payout_run: Box<Account<'info, PayoutRun>>,
    pub mint: Box<InterfaceAccount<'info, Mint>>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = authority,
        token::token_program = token_program
    )]
    pub source_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: Recipient can be any valid pubkey. ATA derivation binds the token account to this key.
    pub recipient: UncheckedAccount<'info>,
    #[account(
        init_if_needed,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = recipient,
        associated_token::token_program = token_program
    )]
    pub recipient_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(
        init,
        payer = authority,
        space = 8 + PayoutReceipt::INIT_SPACE,
        seeds = [PayoutReceipt::SEED_PREFIX, payout_run.key().as_ref(), &item_index.to_le_bytes()],
        bump
    )]
    pub payout_receipt: Box<Account<'info, PayoutReceipt>>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ExecutePayoutItem>, item_index: u32, amount: u64) -> Result<()> {
    require!(amount > 0, CipherpayError::InvalidPayoutAmount);

    let treasury = &ctx.accounts.treasury;
    require!(!treasury.paused, CipherpayError::TreasuryPaused);

    let run = &mut ctx.accounts.payout_run;
    run.assert_executable()?;

    require!(
        item_index < run.expected_item_count,
        CipherpayError::ItemIndexOutOfRange
    );

    let next_item_count = run
        .executed_item_count
        .checked_add(1)
        .ok_or(error!(CipherpayError::RunItemCountExceeded))?;
    let next_amount = run
        .executed_amount
        .checked_add(amount)
        .ok_or(error!(CipherpayError::ArithmeticOverflow))?;

    require!(
        next_item_count <= run.expected_item_count,
        CipherpayError::RunItemCountExceeded
    );
    require!(
        next_amount <= run.total_amount,
        CipherpayError::RunAmountExceeded
    );

    if next_item_count == run.expected_item_count {
        require!(
            next_amount == run.total_amount,
            CipherpayError::FinalRunAmountMismatch
        );
    } else if next_amount == run.total_amount {
        return err!(CipherpayError::RunCompletedTooEarly);
    }

    token_interface::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.source_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    let clock = Clock::get()?;
    let payout_receipt = &mut ctx.accounts.payout_receipt;
    payout_receipt.treasury = treasury.key();
    payout_receipt.run = run.key();
    payout_receipt.run_number = run.run_number;
    payout_receipt.item_index = item_index;
    payout_receipt.authority = ctx.accounts.authority.key();
    payout_receipt.recipient = ctx.accounts.recipient.key();
    payout_receipt.recipient_token_account = ctx.accounts.recipient_token_account.key();
    payout_receipt.mint = ctx.accounts.mint.key();
    payout_receipt.amount = amount;
    payout_receipt.executed_at = clock.unix_timestamp;
    payout_receipt.executed_slot = clock.slot;
    payout_receipt.bump = ctx.bumps.payout_receipt;

    run.executed_item_count = next_item_count;
    run.executed_amount = next_amount;
    run.touch(clock.unix_timestamp);
    run.status = if next_item_count == run.expected_item_count {
        run.completed_at = clock.unix_timestamp;
        PayoutRunStatus::Completed
    } else {
        PayoutRunStatus::InProgress
    };

    emit!(PayoutItemExecuted {
        treasury: treasury.key(),
        run: run.key(),
        receipt: payout_receipt.key(),
        item_index,
        recipient: payout_receipt.recipient,
        amount,
    });

    Ok(())
}
