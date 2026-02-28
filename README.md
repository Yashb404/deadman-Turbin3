# Deadman

Deadman is a Solana smart contract and frontend for a token-based dead man’s switch.

An owner locks SPL tokens in a vault and must periodically ping the contract. If the owner stops pinging and both the interval and grace period expire, the beneficiary can claim the vault balance.

## Deployed Program

- Network: `devnet`
- Program ID: `CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA`

## Repository Structure

```text
deadman/
├── programs/deadman/        # Anchor program
├── tests/                   # Anchor integration tests (TypeScript)
├── frontend/                # Next.js frontend
├── Anchor.toml              # Anchor workspace config
└── txtx.yml                 # Deployment environment config
```

## Contract Overview

### Accounts

`VaultState` stores:

- `owner: Pubkey`
- `beneficiary: Pubkey`
- `mint: Pubkey`
- `interval: i64`
- `grace_period: i64`
- `last_ping_time: i64`
- `bump: u8`

### PDA Derivation

The program uses mint-specific PDAs so one owner can manage separate vaults per token mint.

- `vault_state`: `[b"vault", owner, mint]`
- `vault_token_account`: `[b"token_vault", owner, mint]`

### Instructions

- `initialize(interval, grace_period, deposit_amount)`
Creates the vault state and token vault, validates parameters, and transfers initial tokens.

- `ping()`
Updates `last_ping_time` to keep the vault active.

- `update_interval(new_interval)`
Changes interval with validation.

- `update_beneficiary(new_beneficiary)`
Changes beneficiary with validation.

- `deposit(amount)`
Adds owner tokens to vault.

- `owner_withdraw(amount)`
Allows owner to partially withdraw from vault.

- `withdraw()`
Allows beneficiary withdrawal only after `last_ping_time + interval + grace_period`. Vault state and token account are closed after transfer.

- `cancel_vault()`
Owner cancels vault, withdraws all tokens, and closes vault accounts.

### Validation and Safety Checks

- Interval and grace period must be greater than zero.
- Interval and grace period are bounded by max constants.
- Beneficiary cannot be default pubkey.
- Token account mint/authority checks are explicit.
- Unlock timestamp uses checked math to avoid overflow.

## Prerequisites

- Rust + Cargo
- Solana CLI
- Anchor CLI
- Node.js (LTS) + Yarn

## Setup

From repo root:

```bash
cd deadman
yarn install
cd frontend
yarn install
```

Configure Solana for devnet:

```bash
solana config set --url devnet
```

## Build and Test

Build program:

```bash
cd deadman
anchor build
```

Run tests (local validator):

```bash
anchor test
```

## Deploy to Devnet

```bash
cd deadman
anchor build
anchor deploy --provider.cluster devnet
```

Verify deployment:

```bash
solana program show CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA --url devnet
anchor idl fetch CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA --provider.cluster devnet
```

## Frontend Configuration

Create local env file:

```bash
cd deadman/frontend
cp .env.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_DEADMAN_PROGRAM_ID=CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA
```

Run frontend:

```bash
yarn dev
```

## Website Screenshot

<img width="1855" height="937" alt="Screenshot 2026-03-01 021723" src="https://github.com/user-attachments/assets/91278e48-dd83-41f8-9e36-8a48893f9cbc" />

<img width="1857" height="933" alt="image" src="https://github.com/user-attachments/assets/0e034dbf-4839-47ba-84c1-6f18a0095d5f" />

<img width="1306" height="487" alt="image" src="https://github.com/user-attachments/assets/c3489402-774f-458c-bb73-d994c1ba6ef6" />

## Tests 
<img width="873" height="898" alt="Screenshot 2026-03-01 015126" src="https://github.com/user-attachments/assets/afca8872-de8c-49be-9d25-08ed6d7d3c88" />
<img width="1064" height="962" alt="Screenshot 2026-03-01 015108" src="https://github.com/user-attachments/assets/da390609-dc30-420c-82e8-877e6972066d" />


## Troubleshooting

### Insufficient Funds on Deploy

If deploy fails with insufficient funds, airdrop devnet SOL to deploy wallet and retry:

```bash
solana airdrop 2 <WALLET_PUBKEY> --url devnet
```

### Frontend Connects but Transactions Fail

Check:

- Wallet is set to devnet
- `NEXT_PUBLIC_SOLANA_RPC_URL` points to devnet
- `NEXT_PUBLIC_DEADMAN_PROGRAM_ID` matches deployed program


## Notes

- `Anchor.toml` is configured for devnet by default.
- Program ID is declared in `programs/deadman/src/lib.rs`.
- If program ID changes, update both contract declaration and frontend env.
