use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{mint_to, transfer_checked, Token2022, TokenAccount, TransferChecked, MintTo, Mint},
};

use crate::state::Invoice;
use crate::state::Receipt;
use crate::state::UserAccount;

#[derive(Accounts)]
pub struct Pay<'info> {
    #[account(mut)]
    pub creator: SystemAccount<'info>,

    #[account(mut)]
    pub client: Signer<'info>,

    #[account(mut)]
    pub mint_a: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = client,
        associated_token::mint = mint_a,
        associated_token::authority = client,
        associated_token::token_program = token_program,
    )]
    pub client_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = client,
        associated_token::mint = mint_a,
        associated_token::authority = creator,
        associated_token::token_program = token_program,
    )]
    pub creator_ata_a: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        seeds = [b"user", creator.key().as_ref()],
        bump = invoice.creator_account_bump,
    )]
    pub creator_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"user", client.key().as_ref()],
        bump = invoice.client_account_bump,
    )]
    pub client_account: Account<'info, UserAccount>,

    #[account(
        mut,
        seeds = [b"invoice", creator.key().as_ref()],
        bump,
    )]
    pub invoice: Account<'info, Invoice>,

    #[account(
        init,
        payer = client,
        seeds = [b"receipt",invoice.key().as_ref(),  client.key().as_ref()],
        bump,
        space = 8 + Receipt::INIT_SPACE,
    )]
    pub receipt: Account<'info, Receipt>,

    pub system_program: Program<'info, System>,

    pub associated_token_program: Program<'info, AssociatedToken>,

    pub token_program: Program<'info, Token2022>,
}

impl<'info> Pay<'info> {
    pub fn mint_tokens(&self, mint_amount: u64) -> Result<()>{
        let cpi_program = self.token_program.to_account_info();

        let cpi_accounts = MintTo{
            mint: self.mint_a.to_account_info(),
            to: self.client_ata_a.to_account_info(),
            authority: self.client.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        mint_to(cpi_ctx, mint_amount)
    }

    pub fn pay(&mut self, bumps: &PayBumps) -> Result<()> {
        // send tokens
        let transfer_accounts = TransferChecked{
            from: self.client_ata_a.to_account_info(),
            to: self.creator_ata_a.to_account_info(),
            authority: self.client.to_account_info(),
            mint: self.mint_a.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), transfer_accounts);

        transfer_checked(cpi_ctx, self.invoice.amount, self.mint_a.decimals)?;

        // change invoice "paid" state
        self.invoice.paid = true;

        // change state of client account
        self.client_account.total_payed += self.invoice.amount;

        // change state of creator account
        self.creator_account.total_received += self.invoice.amount;

        // create receipt
        self.receipt.set_inner(Receipt {
            from: self.client.key(),
            to: self.creator.key(),
            amount: self.invoice.amount,
            paid_at: Clock::get()?.unix_timestamp,
            bump: bumps.receipt,
        });

        Ok(())
    }
}
