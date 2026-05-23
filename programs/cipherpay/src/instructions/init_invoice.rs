use anchor_lang::prelude::*;
use crate::state::Invoice;
use crate::state::UserAccount;

#[derive(Accounts)]
pub struct InitInvoice<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    pub client: SystemAccount<'info>,
    #[account(
        seeds = [b"user", creator.key().as_ref()],
        bump,
    )]
    pub creator_account: Account<'info, UserAccount>,

        #[account(
        seeds = [b"user", client.key().as_ref()],
        bump,
    )]
    pub client_account: Account<'info, UserAccount>,
    #[account(
        init,
        payer = creator,
        seeds = [b"invoice", creator.key().as_ref()],
        bump,
        space = 8 + Invoice::INIT_SPACE,
    )]
    pub invoice: Account<'info, Invoice>,
    pub system_program: Program<'info, System>
}

impl <'info> InitInvoice<'info> {
    pub fn init_invoice(&mut self, amount: u64, bumps: &InitInvoiceBumps) -> Result<()>{
        // Initialize the invoice account with default values
        self.invoice.set_inner(Invoice {  
            creator: self.creator.key(), 
            creator_account_bump: bumps.creator_account,
            client: self.client.key(), 
            client_account_bump: bumps.client_account,
            amount, 
            paid: false, 
            created_at: Clock::get()?.unix_timestamp, 
            bump: bumps.invoice
        });

        Ok(())
    }
}