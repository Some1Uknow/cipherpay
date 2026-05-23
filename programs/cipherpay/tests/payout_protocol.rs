use anchor_lang::{InstructionData, ToAccountMetas};
use anchor_litesvm::{
    AnchorContext, AnchorLiteSVM, AssertionHelpers, Keypair, Pubkey, Signer, TestHelpers,
};
use cipherpay::{
    accounts, instruction,
    state::{PayoutReceipt, PayoutRun, PayoutRunStatus, Treasury},
    ID,
};
use solana_sdk::{instruction::Instruction, system_program};
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token::ID as SPL_TOKEN_PROGRAM_ID;

fn setup() -> AnchorContext {
    AnchorLiteSVM::build_with_program(ID, include_bytes!("../../../target/deploy/cipherpay.so"))
}

fn treasury_pda(authority: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[Treasury::SEED_PREFIX, authority.as_ref(), mint.as_ref()],
        &ID,
    )
}

fn payout_run_pda(treasury: &Pubkey, run_number: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PayoutRun::SEED_PREFIX, treasury.as_ref(), &run_number.to_le_bytes()],
        &ID,
    )
}

fn payout_receipt_pda(run: &Pubkey, item_index: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PayoutReceipt::SEED_PREFIX, run.as_ref(), &item_index.to_le_bytes()],
        &ID,
    )
}

fn initialize_treasury_ix(authority: Pubkey, mint: Pubkey, treasury: Pubkey) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::InitializeTreasury {
            authority,
            mint,
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
    total_amount: u64,
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
            total_amount,
            manifest_hash,
        }
        .data(),
    }
}

fn execute_payout_item_ix(
    authority: Pubkey,
    treasury: Pubkey,
    payout_run: Pubkey,
    mint: Pubkey,
    source_token_account: Pubkey,
    recipient: Pubkey,
    recipient_token_account: Pubkey,
    payout_receipt: Pubkey,
    item_index: u32,
    amount: u64,
) -> Instruction {
    Instruction {
        program_id: ID,
        accounts: accounts::ExecutePayoutItem {
            authority,
            treasury,
            payout_run,
            mint,
            source_token_account,
            recipient,
            recipient_token_account,
            payout_receipt,
            associated_token_program: spl_associated_token_account::ID,
            token_program: SPL_TOKEN_PROGRAM_ID,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
        data: instruction::ExecutePayoutItem { item_index, amount }.data(),
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

fn create_initialized_treasury(ctx: &mut AnchorContext) -> (Keypair, Keypair, Pubkey, Pubkey) {
    let authority = ctx.create_funded_account(10_000_000_000).unwrap();
    let mint = ctx.svm.create_token_mint(&authority, 6).unwrap();
    let (treasury, _) = treasury_pda(&authority.pubkey(), &mint.pubkey());

    ctx.execute_instruction(
        initialize_treasury_ix(authority.pubkey(), mint.pubkey(), treasury),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let source_ata = ctx
        .svm
        .create_associated_token_account(&mint.pubkey(), &authority)
        .unwrap();

    (authority, mint, treasury, source_ata)
}

#[test]
fn initializes_treasury_and_creates_first_run() {
    let mut ctx = setup();
    let (authority, mint, treasury, _) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);
    let manifest_hash = [7_u8; 32];

    ctx.execute_instruction(
        create_payout_run_ix(
            authority.pubkey(),
            treasury,
            run,
            0,
            2,
            300,
            manifest_hash,
        ),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let treasury_state: Treasury = ctx.get_account(&treasury).unwrap();
    let run_state: PayoutRun = ctx.get_account(&run).unwrap();

    assert_eq!(treasury_state.authority, authority.pubkey());
    assert_eq!(treasury_state.mint, mint.pubkey());
    assert_eq!(treasury_state.next_run_number, 1);
    assert!(!treasury_state.paused);

    assert_eq!(run_state.treasury, treasury);
    assert_eq!(run_state.authority, authority.pubkey());
    assert_eq!(run_state.mint, mint.pubkey());
    assert_eq!(run_state.run_number, 0);
    assert_eq!(run_state.manifest_hash, manifest_hash);
    assert_eq!(run_state.status, PayoutRunStatus::Draft);
    assert_eq!(run_state.expected_item_count, 2);
    assert_eq!(run_state.executed_item_count, 0);
    assert_eq!(run_state.total_amount, 300);
    assert_eq!(run_state.executed_amount, 0);
}

#[test]
fn executes_two_items_and_completes_the_run() {
    let mut ctx = setup();
    let (authority, mint, treasury, source_ata) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.svm
        .mint_to(&mint.pubkey(), &source_ata, &authority, 300)
        .unwrap();

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 2, 300, [1_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let recipient_one = Keypair::new();
    let recipient_two = Keypair::new();
    let recipient_one_ata = get_associated_token_address_with_program_id(
        &recipient_one.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let recipient_two_ata = get_associated_token_address_with_program_id(
        &recipient_two.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let (receipt_one, _) = payout_receipt_pda(&run, 0);
    let (receipt_two, _) = payout_receipt_pda(&run, 1);

    ctx.execute_instruction(
        execute_payout_item_ix(
            authority.pubkey(),
            treasury,
            run,
            mint.pubkey(),
            source_ata,
            recipient_one.pubkey(),
            recipient_one_ata,
            receipt_one,
            0,
            100,
        ),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    ctx.svm.assert_token_balance(&recipient_one_ata, 100);

    let intermediate_run: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(intermediate_run.status, PayoutRunStatus::InProgress);
    assert_eq!(intermediate_run.executed_item_count, 1);
    assert_eq!(intermediate_run.executed_amount, 100);

    ctx.execute_instruction(
        execute_payout_item_ix(
            authority.pubkey(),
            treasury,
            run,
            mint.pubkey(),
            source_ata,
            recipient_two.pubkey(),
            recipient_two_ata,
            receipt_two,
            1,
            200,
        ),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    ctx.svm.assert_token_balance(&recipient_two_ata, 200);
    ctx.svm.assert_token_balance(&source_ata, 0);

    let receipt_state: PayoutReceipt = ctx.get_account(&receipt_two).unwrap();
    let run_state: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(receipt_state.recipient, recipient_two.pubkey());
    assert_eq!(receipt_state.amount, 200);
    assert_eq!(run_state.status, PayoutRunStatus::Completed);
    assert_eq!(run_state.executed_item_count, 2);
    assert_eq!(run_state.executed_amount, 300);
    assert_eq!(run_state.completed_at, run_state.updated_at);
}

#[test]
fn rejects_duplicate_item_indexes() {
    let mut ctx = setup();
    let (authority, mint, treasury, source_ata) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.svm
        .mint_to(&mint.pubkey(), &source_ata, &authority, 200)
        .unwrap();

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 2, 200, [2_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let recipient = Keypair::new();
    let recipient_ata = get_associated_token_address_with_program_id(
        &recipient.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let (receipt, _) = payout_receipt_pda(&run, 0);
    let ix = execute_payout_item_ix(
        authority.pubkey(),
        treasury,
        run,
        mint.pubkey(),
        source_ata,
        recipient.pubkey(),
        recipient_ata,
        receipt,
        0,
        100,
    );

    ctx.execute_instruction(ix.clone(), &[&authority])
        .unwrap()
        .assert_success();

    ctx.execute_instruction(ix, &[&authority])
        .unwrap()
        .assert_failure();
}

#[test]
fn rejects_early_completion_and_total_overrun() {
    let mut ctx = setup();
    let (authority, mint, treasury, source_ata) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.svm
        .mint_to(&mint.pubkey(), &source_ata, &authority, 300)
        .unwrap();

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 2, 300, [3_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let recipient = Keypair::new();
    let recipient_ata = get_associated_token_address_with_program_id(
        &recipient.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let (receipt_zero, _) = payout_receipt_pda(&run, 0);

    let early_result = ctx
        .execute_instruction(
            execute_payout_item_ix(
                authority.pubkey(),
                treasury,
                run,
                mint.pubkey(),
                source_ata,
                recipient.pubkey(),
                recipient_ata,
                receipt_zero,
                0,
                300,
            ),
            &[&authority],
        )
        .unwrap();
    early_result.assert_failure();
    early_result.assert_error("Custom(6014)");

    let (receipt_one, _) = payout_receipt_pda(&run, 0);
    ctx.execute_instruction(
        execute_payout_item_ix(
            authority.pubkey(),
            treasury,
            run,
            mint.pubkey(),
            source_ata,
            recipient.pubkey(),
            recipient_ata,
            receipt_one,
            0,
            250,
        ),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let second_recipient = Keypair::new();
    let second_recipient_ata = get_associated_token_address_with_program_id(
        &second_recipient.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let (receipt_two, _) = payout_receipt_pda(&run, 1);
    let overrun_result = ctx
        .execute_instruction(
            execute_payout_item_ix(
                authority.pubkey(),
                treasury,
                run,
                mint.pubkey(),
                source_ata,
                second_recipient.pubkey(),
                second_recipient_ata,
                receipt_two,
                1,
                100,
            ),
            &[&authority],
        )
        .unwrap();
    overrun_result.assert_failure();
    overrun_result.assert_error("Custom(6011)");
}

#[test]
fn pause_and_cancel_controls_are_enforced() {
    let mut ctx = setup();
    let (authority, mint, treasury, source_ata) = create_initialized_treasury(&mut ctx);
    let (run, _) = payout_run_pda(&treasury, 0);

    ctx.execute_instruction(
        set_treasury_pause_ix(authority.pubkey(), treasury, true),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let paused_create = ctx
        .execute_instruction(
            create_payout_run_ix(authority.pubkey(), treasury, run, 0, 1, 100, [4_u8; 32]),
            &[&authority],
        )
        .unwrap();
    paused_create.assert_failure();
    paused_create.assert_error("Custom(6001)");

    ctx.execute_instruction(
        set_treasury_pause_ix(authority.pubkey(), treasury, false),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    ctx.svm
        .mint_to(&mint.pubkey(), &source_ata, &authority, 100)
        .unwrap();

    ctx.execute_instruction(
        create_payout_run_ix(authority.pubkey(), treasury, run, 0, 1, 100, [5_u8; 32]),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    ctx.execute_instruction(
        cancel_payout_run_ix(authority.pubkey(), treasury, run),
        &[&authority],
    )
    .unwrap()
    .assert_success();

    let cancelled_run: PayoutRun = ctx.get_account(&run).unwrap();
    assert_eq!(cancelled_run.status, PayoutRunStatus::Cancelled);
    assert_eq!(cancelled_run.cancelled_at, cancelled_run.updated_at);

    let recipient = Keypair::new();
    let recipient_ata = get_associated_token_address_with_program_id(
        &recipient.pubkey(),
        &mint.pubkey(),
        &SPL_TOKEN_PROGRAM_ID,
    );
    let (receipt, _) = payout_receipt_pda(&run, 0);
    let cancelled_execution = ctx
        .execute_instruction(
            execute_payout_item_ix(
                authority.pubkey(),
                treasury,
                run,
                mint.pubkey(),
                source_ata,
                recipient.pubkey(),
                recipient_ata,
                receipt,
                0,
                100,
            ),
            &[&authority],
        )
        .unwrap();
    cancelled_execution.assert_failure();
    cancelled_execution.assert_error("Custom(6009)");
}
