#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
mod instructions;
mod state;
use crate::instructions::*;

declare_id!("C3qyHGtVXDTDqKR7ng1Q4ikYK2mKxyqtZLcWpgA1fKZV");

#[program]
pub mod cipherpay {
    use super::*;

    pub fn register(ctx: Context<InitUser>, name: String) -> Result<()> {
        ctx.accounts.init_user(name, &ctx.bumps)
    }

    pub fn create_invoice(ctx: Context<InitInvoice>, amount: u64) -> Result<()>{
        ctx.accounts.init_invoice(amount ,&ctx.bumps)
    }

    pub fn pay_invoice(ctx: Context<Pay>, mint_amount: u64) -> Result<()>{
        ctx.accounts.mint_tokens(mint_amount)?;
        ctx.accounts.pay(&ctx.bumps)
    }
}
