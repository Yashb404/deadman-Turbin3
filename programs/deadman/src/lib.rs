use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, Transfer};

declare_id!("CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA");

#[program]
pub mod deadman {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        interval: i64,
        grace_period: i64,
        deposit_amount: u64,
    ) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        let clock = Clock::get()?;

        vault_state.owner = ctx.accounts.owner.key();
        vault_state.beneficiary = ctx.accounts.beneficiary.key();
        vault_state.mint = ctx.accounts.mint.key();
        vault_state.interval = interval;
        vault_state.grace_period = grace_period;
        vault_state.last_ping_time = clock.unix_timestamp;
        vault_state.bump = ctx.bumps.vault_state;

        let cpi_accounts = Transfer {
            from: ctx.accounts.owner_token_account.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, deposit_amount)?;

        Ok(())
    }

    pub fn ping(ctx: Context<Ping>) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        let clock = Clock::get()?;

        vault_state.last_ping_time = clock.unix_timestamp;
        
        Ok(())
    }

    pub fn update_interval(ctx: Context<UpdateInterval>, new_interval: i64) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        vault_state.interval = new_interval;
        
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        let vault_state = &mut ctx.accounts.vault_state;
        let clock = Clock::get()?;

        require!(
            clock.unix_timestamp > vault_state.last_ping_time + vault_state.interval + vault_state.grace_period,
            ErrorCode::VaultStillActive
        );

        let amount = ctx.accounts.vault_token_account.amount;

        let owner_key = vault_state.owner;
        let bump = vault_state.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", owner_key.as_ref(), &[bump]]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.beneficiary_token_account.to_account_info(),
            authority: vault_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
        token::transfer(transfer_ctx, amount)?;

        let close_accounts = CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.beneficiary.to_account_info(),
            authority: vault_state.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer_seeds,
        );
        token::close_account(close_ctx)?;

        Ok(())
    }

    pub fn cancel_vault(ctx: Context<CancelVault>) -> Result<()> {
        let vault_state = &ctx.accounts.vault_state;
        let amount = ctx.accounts.vault_token_account.amount;

        let owner_key = vault_state.owner;
        let bump = vault_state.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[b"vault", owner_key.as_ref(), &[bump]]];

        let transfer_accounts = Transfer {
            from: ctx.accounts.vault_token_account.to_account_info(),
            to: ctx.accounts.owner_token_account.to_account_info(),
            authority: vault_state.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let transfer_ctx = CpiContext::new_with_signer(cpi_program, transfer_accounts, signer_seeds);
        token::transfer(transfer_ctx, amount)?;

        let close_accounts = CloseAccount {
            account: ctx.accounts.vault_token_account.to_account_info(),
            destination: ctx.accounts.owner.to_account_info(),
            authority: vault_state.to_account_info(),
        };
        let close_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            close_accounts,
            signer_seeds,
        );
        token::close_account(close_ctx)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub beneficiary: AccountInfo<'info>,
    
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = vault_state,
        seeds = [b"token_vault", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1, 
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault_state: Account<'info, VaultState>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Ping<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
}

#[derive(Accounts)]
pub struct UpdateInterval<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,

    #[account(
        mut,
        has_one = beneficiary,
        close = beneficiary, 
        seeds = [b"vault", vault_state.owner.as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"token_vault", vault_state.owner.as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelVault<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        close = owner,
        seeds = [b"vault", owner.key().as_ref()],
        bump = vault_state.bump
    )]
    pub vault_state: Account<'info, VaultState>,

    #[account(
        mut,
        seeds = [b"token_vault", owner.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[account]
pub struct VaultState {
    pub owner: Pubkey,
    pub beneficiary: Pubkey,
    pub mint: Pubkey,
    pub interval: i64,
    pub grace_period: i64,
    pub last_ping_time: i64,
    pub bump: u8,
}

#[error_code]
pub enum ErrorCode {
    #[msg("The vault is still active. The interval and grace period have not passed yet.")]
    VaultStillActive,
}