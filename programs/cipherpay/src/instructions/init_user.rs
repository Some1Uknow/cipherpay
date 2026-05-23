use anchor_lang::prelude::*;
use crate::state::UserAccount;

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init,
        payer = user,
        seeds = [b"user", user.key().as_ref()],
        bump,
        space = 8 + UserAccount::INIT_SPACE,
    )]
    pub user_account: Account<'info, UserAccount>,
    pub system_program: Program<'info, System>
}

impl <'info> InitUser<'info> {
    pub fn init_user(&mut self,name: String, bumps: &InitUserBumps) -> Result<()>{
        // Initialize the user account with default values
        self.user_account.set_inner(UserAccount {  
            name,
            total_received: 0, 
            total_payed: 0, 
            bump: bumps.user_account
        });

        Ok(())
    }
}