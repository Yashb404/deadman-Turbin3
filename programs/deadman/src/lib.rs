use anchor_lang::prelude::*;

declare_id!("CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA");

#[program]
pub mod deadman {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
