import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { IDL } from "./deadman-idl";

const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_DEADMAN_PROGRAM_ID ?? "CMDpyVccyoGAYbWApqoHJizCUM6vYFTbQJ9WpdNQfygA"
);

export const getProgram = (provider: anchor.AnchorProvider) => {
  return new anchor.Program(IDL as unknown as anchor.Idl, PROGRAM_ID, provider);
};

export const getVaultPDA = (ownerPubkey: PublicKey, mintPubkey: PublicKey) => {
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), ownerPubkey.toBuffer(), mintPubkey.toBuffer()],
    PROGRAM_ID
  );
  return { vaultPda, vaultBump };
};

export const getVaultTokenPDA = (ownerPubkey: PublicKey, mintPubkey: PublicKey) => {
  const [tokenVaultPda, tokenVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), ownerPubkey.toBuffer(), mintPubkey.toBuffer()],
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
    return vault as unknown as VaultState;
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
  const { vaultPda } = getVaultPDA(owner, mint);
  const { tokenVaultPda } = getVaultTokenPDA(owner, mint);

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
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
    })
    .transaction();

  return sendTransaction(tx);
};

export const pingVault = async (
  program: anchor.Program,
  owner: PublicKey,
  mint: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);

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
  mint: PublicKey,
  newInterval: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);

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
  mint: PublicKey,
  newBeneficiary: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);

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
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  amount: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);
  const { tokenVaultPda } = getVaultTokenPDA(owner, mint);

  const tx = await program.methods
    .deposit(new anchor.BN(amount))
    .accounts({
      owner,
      vaultState: vaultPda,
      ownerTokenAccount,
      vaultTokenAccount: tokenVaultPda,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return sendTransaction(tx);
};

export const ownerWithdraw = async (
  program: anchor.Program,
  owner: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  amount: number,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);
  const { tokenVaultPda } = getVaultTokenPDA(owner, mint);

  const tx = await program.methods
    .ownerWithdraw(new anchor.BN(amount))
    .accounts({
      owner,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      ownerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
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
  mintPubkey: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { tokenVaultPda } = getVaultTokenPDA(ownerPubkey, mintPubkey);

  const tx = await program.methods
    .withdraw()
    .accounts({
      beneficiary,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      beneficiaryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return sendTransaction(tx);
};

export const cancelVault = async (
  program: anchor.Program,
  owner: PublicKey,
  mint: PublicKey,
  ownerTokenAccount: PublicKey,
  sendTransaction: (tx: anchor.web3.Transaction) => Promise<string>
) => {
  const { vaultPda } = getVaultPDA(owner, mint);
  const { tokenVaultPda } = getVaultTokenPDA(owner, mint);

  const tx = await program.methods
    .cancelVault()
    .accounts({
      owner,
      vaultState: vaultPda,
      vaultTokenAccount: tokenVaultPda,
      ownerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  return sendTransaction(tx);
};
