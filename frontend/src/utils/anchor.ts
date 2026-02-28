import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { IDL } from "./deadman-idl";

const PROGRAM_ID = new PublicKey("CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA");

export const getProgram = (provider: anchor.AnchorProvider) => {
  return new anchor.Program(IDL as anchor.Idl, PROGRAM_ID, provider);
};

export const getVaultPDA = (ownerPubkey: PublicKey) => {
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerPubkey.toBuffer()],
    PROGRAM_ID
  );
  return { vaultPda, vaultBump };
};

export const getVaultTokenPDA = (ownerPubkey: PublicKey) => {
  const [tokenVaultPda, tokenVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), ownerPubkey.toBuffer()],
    PROGRAM_ID
  );
  return { tokenVaultPda, tokenVaultBump };
};

export interface VaultState {
  owner: PublicKey;
  beneficiary: PublicKey;
  mint: PublicKey;
  interval: anchor.BN;
  gracePeriod: anchor.BN;
  lastPingTime: anchor.BN;
  bump: number;
}

export const fetchVaultState = async (
  program: anchor.Program,
  vaultPda: PublicKey
): Promise<VaultState | null> => {
  try {
    const vault = await program.account.vaultState.fetch(vaultPda);
    return vault as VaultState;
  } catch (error) {
    console.error("Error fetching vault state:", error);
    return null;
  }
};

export const initializeVault = async (
  program: anchor.Program,
  owner: PublicKey,
  beneficiary: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  interval: number,
  gracePeriod: number,
  depositAmount: number,
  sendTransaction: (tx: anchor.web3.Transaction, signers?: anchor.web3.Signer[]) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);
  const { tokenVaultPda } = getVaultTokenPDA(owner);

  const tx = await program.methods
    .initialize(
      new anchor.BN(interval),
      new anchor.BN(gracePeriod),
      new anchor.BN(depositAmount)
    )
    .accounts({
      owner,
      beneficiary,
      mint,
      ownerTokenAccount,
      vaultTokenAccount: tokenVaultPda,
      vaultState: vaultPda,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen"),
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  return sendTransaction(tx);
};

export const pingVault = async (
  program: anchor.Program,
  owner: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);

  const tx = await program.methods
    .ping()
    .accounts({
      owner,
      vaultState: vaultPda,
    })
    .transaction();

  return sendTransaction(tx);
};

export const updateInterval = async (
  program: anchor.Program,
  owner: PublicKey,
  newInterval: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);

  const tx = await program.methods
    .updateInterval(new anchor.BN(newInterval))
    .accounts({
      owner,
      vaultState: vaultPda,
    })
    .transaction();

  return sendTransaction(tx);
};

export const updateBeneficiary = async (
  program: anchor.Program,
  owner: PublicKey,
  newBeneficiary: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);

  const tx = await program.methods
    .updateBeneficiary(newBeneficiary)
    .accounts({
      owner,
      vaultState: vaultPda,
    })
    .transaction();

  return sendTransaction(tx);
};

export const depositTokens = async (
  program: anchor.Program,
  owner: PublicKey,
  ownerTokenAccount: PublicKey,
  amount: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);
  const { tokenVaultPda } = getVaultTokenPDA(owner);

  const tx = await program.methods
    .deposit(new anchor.BN(amount))
    .accounts({
      owner,
      vaultState: vaultPda,
      ownerTokenAccount,
      vaultTokenAccount: tokenVaultPda,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen"),
    })
    .transaction();

  return sendTransaction(tx);
};

export const ownerWithdraw = async (
  program: anchor.Program,
  owner: PublicKey,
  ownerTokenAccount: PublicKey,
  amount: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);
  const { tokenVaultPda } = getVaultTokenPDA(owner);

  const tx = await program.methods
    .ownerWithdraw(new anchor.BN(amount))
    .accounts({
      owner,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      ownerTokenAccount,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen"),
    })
    .transaction();

  return sendTransaction(tx);
};

export const claimInheritance = async (
  program: anchor.Program,
  beneficiary: PublicKey,
  beneficiaryTokenAccount: PublicKey,
  vaultPda: PublicKey,
  ownerPubkey: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { tokenVaultPda } = getVaultTokenPDA(ownerPubkey);

  const tx = await program.methods
    .withdraw()
    .accounts({
      beneficiary,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      beneficiaryTokenAccount,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen"),
    })
    .transaction();

  return sendTransaction(tx);
};

export const cancelVault = async (
  program: anchor.Program,
  owner: PublicKey,
  ownerTokenAccount: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner);
  const { tokenVaultPda } = getVaultTokenPDA(owner);

  const tx = await program.methods
    .cancelVault()
    .accounts({
      owner,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      ownerTokenAccount,
      tokenProgram: new PublicKey("TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen"),
    })
    .transaction();

  return sendTransaction(tx);
};
