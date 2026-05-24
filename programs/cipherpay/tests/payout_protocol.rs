use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_litesvm::{
    AnchorContext, AnchorLiteSVM, Keypair, Pubkey, Signer,
};
use cipherpay::{
    accounts, instruction,
    instructions::MAX_BATCH_ITEMS,
    state::{PayoutItem, PayoutReceipt, PayoutRun, PayoutRunStatus, Treasury},
    ID,
};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    system_program,
};

fn setup() -> AnchorContext {
    AnchorLiteSVM::build_with_program(ID, include_bytes!("../../../target/deploy/cipherpay.so"))
}

fn treasury_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[Treasury::SEED_PREFIX, authority.as_ref()], &ID)
}

fn payout_run_pda(treasury: &Pubkey, run_number: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PayoutRun::SEED_PREFIX, treasury.as_ref(), &run_number.to_le_bytes()],
        &ID,
    )
}

fn payout_item_pda(run: &Pubkey, item_index: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PayoutItem::SEED_PREFIX, run.as_ref(), &item_index.to_le_bytes()],
        &ID,
    )
}

fn payout_receipt_pda(run: &Pubkey, item_index: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PayoutReceipt::SEED_PREFIX, run.as_ref(), &item_index.to_le_bytes()],
        &ID,
    )
}

fn lamports(ctx: &AnchorContext, pubkey: &Pubkey) -> u64 {
    ctx.svm.get_account(pubkey).unwrap().lamports
}

fn initialize_treasury_ix(authority: Pubkey, treasury: Pubkey) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::InitializeTreasury {
            authority,
            treasury,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::InitializeTreasury {}.data(),
    }
}

fn set_treasury_pause_ix(authority: Pubkey, treasury: Pubkey, paused: bool) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::SetTreasuryPause { authority, treasury }.to_account_metas(None),
        data: instruction::SetTreasuryPause { paused }.data(),
    }
}

fn create_payout_run_ix(
    authority: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    run_number: u64,
    expected_item_count: u32,
    total_lamports: u64,
    manifest_hash: [u8; 32],
) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::CreatePayoutRun {
            authority,
            treasury,
            payout_run,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::CreatePayoutRun {
            run_number,
            expected_item_count,
            total_lamports,
            manifest_hash,
        }
        .data(),
    }
}

fn create_payout_item_ix(
    authority: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    payout_item: Pubkey,
    item_index: u32,
    recipient: Pubkey,
    lamports: u64,
) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::CreatePayoutItem {
            authority,
            treasury,
            payout_run,
            payout_item,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::CreatePayoutItem {
            item_index,
            recipient,
            lamports,
        }
        .data(),
    }
}

fn fund_payout_run_ix(authority: Pubkey, treasury: Pubkey, payout_run: Pubkey) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::FundPayoutRun {
            authority,
            treasury,
            payout_run,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::FundPayoutRun {}.data(),
    }
}

fn execute_payout_item_ix(
    executor: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    payout_item: Pubkey,
    recipient: Pubkey,
    payout_receipt: Pubkey,
    item_index: u32,
) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::ExecutePayoutItem {
            executor,
            treasury,
            payout_run,
            payout_item,
            recipient,
            payout_receipt,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::ExecutePayoutItem { item_index }.data(),
    }
}

fn execute_payout_items_ix(
    executor: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    item_indexes: Vec<u32>,
) -> Instruction {
    let mut accounts = accounts::ExecutePayoutItems {
        executor,
        treasury,
        payout_run,
        system_program: system_program::ID,
    }
    .to_account_metas(None);

    for item_index in &item_indexes {
        let (item, _) = payout_item_pda(&payout_run, *item_index);
        let (receipt, _) = payout_receipt_pda(&payout_run, *item_index);
        accounts.push(AccountMeta::new(item, false));
        accounts.push(AccountMeta::new(Pubkey::default(), false));
        accounts.push(AccountMeta::new(receipt, false));
    }

    Instruction {
        program_id: ID,
        accounts,
        data: instruction::ExecutePayoutItems { item_indexes }.data(),
    }
}

fn execute_payout_items_ix_with_recipients(
    executor: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    items: &[(u32, Pubkey)],
) -> Instruction {
    let item_indexes = items.iter().map(|(index, _)| *index).collect::<Vec<_>>();
    let mut accounts = accounts::ExecutePayoutItems {
        executor,
        treasury,
        payout_run,
        system_program: system_program::ID,
    }
    .to_account_metas(None);

    for (item_index, recipient) in items {
        let (item, _) = payout_item_pda(&payout_run, *item_index);
        let (receipt, _) = payout_receipt_pda(&payout_run, *item_index);
        accounts.push(AccountMeta::new(item, false));
        accounts.push(AccountMeta::new(*recipient, false));
        accounts.push(AccountMeta::new(receipt, false));
    }

    Instruction {
        program_id: ID,
        accounts,
        data: instruction::ExecutePayoutItems { item_indexes }.data(),
    }
}

fn cancel_payout_run_ix(authority: Pubkey, treasury: Pubkey, payout_run: Pubkey) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::CancelPayoutRun {
            authority,
            treasury,
            payout_run,
        }
        .to_account_metas(None),
        data: instruction::CancelPayoutRun {}.data(),
    }
}

fn refund_payout_run_ix(authority: Pubkey, treasury: Pubkey, payout_run: Pubkey) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::RefundPayoutRun {
            authority,
            treasury,
            payout_run,
        }
        .to_account_metas(None),
        data: instruction::RefundPayoutRun {}.data(),
    }
}

fn create_initialized_treasury(ctx: &mut AnchorContext) -> (Keypair, Pubkey) {
    let authority = ctx.create_funded_account(10_000_000_000).unwrap();
    let (treasury, _) = treasury_pda(&authority.pubkey());

    ctx.execute_instruction(initialize_treasury_ix(authority.pubkey(), treasury), &[&authority])
        .unwrap()
        .assert_success();

    (authority, treasury)
}

fn create_run_with_items(
    ctx: &mut AnchorContext,
    authority: &Keypair,
    treasury: Pubkey,
    total_lamports: u64,
    payouts: &[(Keypair, u64)],
) -> Pubkey {
    let (run, _) = payout_run_pda(&treasury, 0);
    ctx.execute_instruction(
        create_payout_run_ix(
            authority.pubkey(),
            treasury,
            run,
            0,
            payouts.len() as u32,
            total_lamports,
            [9_u8; 32],
        ),
        &[authority],
    )
    .unwrap()
    .assert_success();

    for (index, (recipient, amount)) in payouts.iter().enumerate() {
        let (item, _) = payout_item_pda(&run, index as u32);
        ctx.execute_instruction(
            create_payout_item_ix(
                authority.pubkey(),
                treasury,
                run,
                item,
                index as u32,
                recipient.pubkey(),
                *amount,
            ),
            &[authority],
        )
        .unwrap()
        .assert_success();
    }

    run
}

#[test]
fn initializes_treasury_and_creates_first_run() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 2, 300, [7_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let treasury_state: Treasury = ctx.get_account(&treasury).unwrap();
    let run_state: PayoutRun = ctx.get_account(&run).unwrap();

    assert_eq!(treasury_state.authority, authority.pubkey());
    assert_eq!(treasury_state.next_run_number, 1);
    assert!(!treasury_state.paused);

    assert_eq!(run_state.treasury, treasury);
    assert_eq!(run_state.authority, authority.pubkey());
    assert_eq!(run_state.run_number, 0);
    assert_eq!(run_state.manifest_hash, [7_u8; 32]);
    assert_eq!(run_state.status, PayoutRunStatus::Draft);
    assert_eq!(run_state.expected_item_count, 2);
    assert_eq!(run_state.created_item_count, 0);
    assert_eq!(run_state.executed_item_count, 0);
    assert_eq!(run_state.total_lamports, 300);
    assert_eq!(run_state.deposited_lamports, 0);
}

#[test]
fn creates_items_funds_once_and_permissionlessly_executes_to_completion() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let recipient_one = ctx.create_funded_account(1_000_000).unwrap();
    let recipient_two = ctx.create_funded_account(1_000_000).unwrap();
    let executor = ctx.create_funded_account(1_000_000_000).unwrap();
    let run = create_run_with_items(
        &mut ctx,
        &authority,
        treasury,
        300,
        &[(recipient_one.insecure_clone(), 100), (recipient_two.insecure_clone(), 200)],
    );

    ctx.execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();

    let run_after_fund: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(run_after_fund.status, PayoutRunStatus::Funded);
    assert_eq!(run_after_fund.deposited_lamports, 300);

    let recipient_one_before = lamports(&ctx, &recipient_one.pubkey());
    let recipient_two_before = lamports(&ctx, &recipient_two.pubkey());
    let (item_zero, _) = payout_item_pda(&run, 0);
    let (receipt_zero, _) = payout_receipt_pda(&run, 0);
    ctx.execute_instruction(
        execute_payout_item_ix(
            executor.pubkey(),
            treasury,
            run,
            item_zero,
            recipient_one.pubkey(),
            receipt_zero,
            0,
        ),
        &[&executor],
    )
    .unwrap()
    .assert_success();

    assert_eq!(lamports(&ctx, &recipient_one.pubkey()), recipient_one_before + 100);
    let intermediate_run: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(intermediate_run.status, PayoutRunStatus::InProgress);
    assert_eq!(intermediate_run.executed_item_count, 1);
    assert_eq!(intermediate_run.executed_lamports, 100);

    let (item_one, _) = payout_item_pda(&run, 1);
    let (receipt_one, _) = payout_receipt_pda(&run, 1);
    ctx.execute_instruction(
        execute_payout_item_ix(
            executor.pubkey(),
            treasury,
            run,
            item_one,
            recipient_two.pubkey(),
            receipt_one,
            1,
        ),
        &[&executor],
    )
    .unwrap()
    .assert_success();

    assert_eq!(lamports(&ctx, &recipient_two.pubkey()), recipient_two_before + 200);
    let receipt_state: PayoutReceipt = ctx.get_account(&receipt_one).unwrap();
    let run_state: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(receipt_state.recipient, recipient_two.pubkey());
    assert_eq!(receipt_state.lamports, 200);
    assert_eq!(run_state.status, PayoutRunStatus::Completed);
    assert_eq!(run_state.executed_item_count, 2);
    assert_eq!(run_state.executed_lamports, 300);
    assert_eq!(run_state.completed_at, run_state.updated_at);
}

#[test]
fn rejects_mutated_recipient_and_duplicate_execution() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let recipient = ctx.create_funded_account(1_000_000).unwrap();
    let attacker_recipient = ctx.create_funded_account(1_000_000).unwrap();
    let executor = ctx.create_funded_account(1_000_000_000).unwrap();
    let run = create_run_with_items(
        &mut ctx,
        &authority,
        treasury,
        1_000_000,
        &[(recipient.insecure_clone(), 1_000_000)],
    );
    ctx.execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();

    let (item, _) = payout_item_pda(&run, 0);
    let (receipt, _) = payout_receipt_pda(&run, 0);
    let mutated_recipient = ctx
        .execute_instruction(
            execute_payout_item_ix(
                executor.pubkey(),
                treasury,
                run,
                item,
                attacker_recipient.pubkey(),
                receipt,
                0,
            ),
            &[&executor],
        )
        .unwrap();
    mutated_recipient.assert_failure();

    let ix = execute_payout_item_ix(
        executor.pubkey(),
        treasury,
        run,
        item,
        recipient.pubkey(),
        receipt,
        0,
    );
    ctx.execute_instruction(ix.clone(), &[&executor])
        .unwrap()
        .assert_success();
    ctx.svm.expire_blockhash();
    ctx.execute_instruction(ix, &[&executor])
        .unwrap()
        .assert_failure();
}

#[test]
fn rejects_funding_before_all_items_match_total() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let recipient = ctx.create_funded_account(1_000_000).unwrap();
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 2, 300, [3_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let early_fund = ctx
        .execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap();
    early_fund.assert_failure();

    let (item_zero, _) = payout_item_pda(&run, 0);
    ctx.execute_instruction(
        create_payout_item_ix(
            authority.pubkey(),
            treasury,
            run,
            item_zero,
            0,
            recipient.pubkey(),
            100,
        ),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let partial_fund = ctx
        .execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap();
    partial_fund.assert_failure();
}

#[test]
fn batch_executes_up_to_safe_chunk_size_and_rejects_larger_batches() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let executor = ctx.create_funded_account(2_000_000_000).unwrap();
    let recipients = (0..MAX_BATCH_ITEMS)
        .map(|_| ctx.create_funded_account(1_000_000).unwrap())
        .collect::<Vec<_>>();
    let payouts = recipients
        .iter()
        .map(|recipient| (recipient.insecure_clone(), 10))
        .collect::<Vec<_>>();
    let run = create_run_with_items(&mut ctx, &authority, treasury, 80, &payouts);

    ctx.execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();

    let before = recipients
        .iter()
        .map(|recipient| lamports(&ctx, &recipient.pubkey()))
        .collect::<Vec<_>>();
    let items = recipients
        .iter()
        .enumerate()
        .map(|(index, recipient)| (index as u32, recipient.pubkey()))
        .collect::<Vec<_>>();

    ctx.execute_instruction(
        execute_payout_items_ix_with_recipients(executor.pubkey(), treasury, run, &items),
        &[&executor],
    )
    .unwrap()
    .assert_success();

    for (index, recipient) in recipients.iter().enumerate() {
        assert_eq!(lamports(&ctx, &recipient.pubkey()), before[index] + 10);
    }
    let run_state: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(run_state.status, PayoutRunStatus::Completed);
    assert_eq!(run_state.executed_item_count as usize, MAX_BATCH_ITEMS);

    let too_many = (0..=MAX_BATCH_ITEMS as u32).collect::<Vec<_>>();
    let rejected = ctx
        .execute_instruction(
            execute_payout_items_ix(executor.pubkey(), treasury, run, too_many),
            &[&executor],
        )
        .unwrap();
    rejected.assert_failure();
}

#[test]
fn pause_cancel_and_refund_controls_are_enforced() {
    let mut ctx = setup();
    let (authority, treasury) = create_initialized_treasury(&mut ctx);
    let recipient = ctx.create_funded_account(1_000_000).unwrap();
    let run = create_run_with_items(
        &mut ctx,
        &authority,
        treasury,
        1_000_000,
        &[(recipient.insecure_clone(), 1_000_000)],
    );

    ctx.execute_instruction(
        set_treasury_pause_ix(authority.pubkey(), treasury, true),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let paused_fund = ctx
        .execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap();
    paused_fund.assert_failure();
    ctx.svm.expire_blockhash();

    ctx.execute_instruction(
        set_treasury_pause_ix(authority.pubkey(), treasury, false),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    ctx.execute_instruction(fund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();

    ctx.execute_instruction(cancel_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();
    let authority_before_refund = lamports(&ctx, &authority.pubkey());

    let cancelled_run: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(cancelled_run.status, PayoutRunStatus::Cancelled);
    assert_eq!(cancelled_run.cancelled_at, cancelled_run.updated_at);

    ctx.execute_instruction(refund_payout_run_ix(authority.pubkey(), treasury, run), &[&authority])
        .unwrap()
        .assert_success();

    let refunded_run: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(refunded_run.refunded_lamports, 1_000_000);
    assert!(lamports(&ctx, &authority.pubkey()) > authority_before_refund);
}
