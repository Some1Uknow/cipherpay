#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("C3qyHGtVXDTDqKR7ng1Q4ikYK2mKxyqtZLcWpgA1fKZV");

#[program]
pub mod cipherpay {
    use super::*;

    pub fn initialize_treasury(ctx: Context<InitializeTreasury>) -> Result<()> {
        instructions::initialize_treasury::handler(ctx)
    }

    pub fn set_treasury_pause(ctx: Context<SetTreasuryPause>, paused: bool) -> Result<()> {
        instructions::set_treasury_pause::handler(ctx, paused)
    }

    pub fn create_payout_run(
        ctx: Context<CreatePayoutRun>,
        run_number: u64,
        expected_item_count: u32,
        total_amount: u64,
        manifest_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_payout_run::handler(
            ctx,
            run_number,
            expected_item_count,
            total_amount,
            manifest_hash,
        )
    }

    pub fn execute_payout_item(
        ctx: Context<ExecutePayoutItem>,
        item_index: u32,
        amount: u64,
    ) -> Result<()> {
        instructions::execute_payout_item::handler(ctx, item_index, amount)
    }

    pub fn cancel_payout_run(ctx: Context<CancelPayoutRun>) -> Result<()> {
        instructions::cancel_payout_run::handler(ctx)
    }
}
