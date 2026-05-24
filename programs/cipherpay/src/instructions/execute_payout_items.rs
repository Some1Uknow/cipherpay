use anchor_lang::{prelude::*, system_program, AccountSerialize};

use crate::{
    errors::CipherpayError,
    events::PayoutItemExecuted,
    instructions::execute_payout_item::{
        mark_run_execution, transfer_from_run_escrow, validate_item_execution, MAX_BATCH_ITEMS,
    },
    state::{PayoutItem, PayoutReceipt, PayoutRun, Treasury},
};

#[derive(Accounts)]
pub struct ExecutePayoutItems<'info> {
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
    pub system_program: Program<'info, System>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, 'info, 'info, ExecutePayoutItems<'info>>,
    item_indexes: Vec<u32>,
) -> Result<()> {
    require!(!ctx.accounts.treasury.paused, CipherpayError::TreasuryPaused);
    require!(!item_indexes.is_empty(), CipherpayError::InvalidBatchSize);
    require!(
        item_indexes.len() <= MAX_BATCH_ITEMS,
        CipherpayError::BatchTooLarge
    );
    require!(
        ctx.remaining_accounts.len() == item_indexes.len() * 3,
        CipherpayError::InvalidRemainingAccounts
    );

    for left in 0..item_indexes.len() {
        for right in (left + 1)..item_indexes.len() {
            require!(
                item_indexes[left] != item_indexes[right],
                CipherpayError::DuplicateBatchItem
            );
        }
    }

    let clock = Clock::get()?;
    for (position, item_index) in item_indexes.iter().enumerate() {
        let item_info = &ctx.remaining_accounts[position * 3];
        let recipient_info = &ctx.remaining_accounts[position * 3 + 1];
        let receipt_info = &ctx.remaining_accounts[position * 3 + 2];

        let expected_item = Pubkey::find_program_address(
            &[
                PayoutItem::SEED_PREFIX,
                ctx.accounts.payout_run.key().as_ref(),
                &item_index.to_le_bytes(),
            ],
            ctx.program_id,
        )
        .0;
        require!(
            item_info.key() == expected_item,
            CipherpayError::InvalidPayoutItem
        );

        let (expected_receipt, receipt_bump) = Pubkey::find_program_address(
            &[
                PayoutReceipt::SEED_PREFIX,
                ctx.accounts.payout_run.key().as_ref(),
                &item_index.to_le_bytes(),
            ],
            ctx.program_id,
        );
        require!(
            receipt_info.key() == expected_receipt,
            CipherpayError::ReceiptPdaMismatch
        );

        let mut payout_item: Account<PayoutItem> = Account::try_from(item_info)?;
        validate_item_execution(
            &ctx.accounts.treasury,
            &ctx.accounts.payout_run,
            &payout_item,
            recipient_info,
            *item_index,
        )?;

        create_receipt_account(
            &ctx.accounts.executor,
            receipt_info,
            &ctx.accounts.system_program,
            ctx.accounts.payout_run.key(),
            *item_index,
            receipt_bump,
        )?;

        transfer_from_run_escrow(
            &ctx.accounts.payout_run.to_account_info(),
            recipient_info,
            payout_item.lamports,
        )?;

        payout_item.executed = true;
        payout_item.executed_at = clock.unix_timestamp;
        payout_item.executed_slot = clock.slot;
        payout_item.exit(ctx.program_id)?;

        write_receipt(
            &ctx.accounts.treasury,
            &ctx.accounts.payout_run,
            &payout_item,
            receipt_info,
            *item_index,
            receipt_bump,
            &clock,
        )?;

        mark_run_execution(
            &mut ctx.accounts.payout_run,
            payout_item.lamports,
            clock.unix_timestamp,
        )?;

        emit!(PayoutItemExecuted {
            treasury: ctx.accounts.treasury.key(),
            run: ctx.accounts.payout_run.key(),
            item: payout_item.key(),
            receipt: receipt_info.key(),
            item_index: *item_index,
            recipient: payout_item.recipient,
            lamports: payout_item.lamports,
        });
    }

    Ok(())
}

fn create_receipt_account<'info>(
    executor: &Signer<'info>,
    receipt_info: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    run: Pubkey,
    item_index: u32,
    bump: u8,
) -> Result<()> {
    let space = 8 + PayoutReceipt::INIT_SPACE;
    let rent_lamports = Rent::get()?.minimum_balance(space);
    let item_index_bytes = item_index.to_le_bytes();
    let signer_seeds: &[&[&[u8]]] = &[&[
        PayoutReceipt::SEED_PREFIX,
        run.as_ref(),
        &item_index_bytes,
        &[bump],
    ]];

    system_program::create_account(
        CpiContext::new_with_signer(
            system_program.to_account_info(),
            system_program::CreateAccount {
                from: executor.to_account_info(),
                to: receipt_info.clone(),
            },
            signer_seeds,
        ),
        rent_lamports,
        space as u64,
        &crate::ID,
    )
}

fn write_receipt<'info>(
    treasury: &Account<'info, Treasury>,
    payout_run: &Account<'info, PayoutRun>,
    payout_item: &Account<'info, PayoutItem>,
    receipt_info: &AccountInfo<'info>,
    item_index: u32,
    bump: u8,
    clock: &Clock,
) -> Result<()> {
    let receipt = PayoutReceipt {
        treasury: treasury.key(),
        run: payout_run.key(),
        item: payout_item.key(),
        run_number: payout_run.run_number,
        item_index,
        authority: payout_run.authority,
        recipient: payout_item.recipient,
        lamports: payout_item.lamports,
        executed_at: clock.unix_timestamp,
        executed_slot: clock.slot,
        bump,
    };

    let mut data = receipt_info.try_borrow_mut_data()?;
    let mut writer = &mut data[..];
    receipt.try_serialize(&mut writer)
}
