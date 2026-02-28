import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Deadman } from "../target/types/deadman";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("deadman", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Deadman as Program<Deadman>;

  const owner = anchor.web3.Keypair.generate();
  const beneficiary = anchor.web3.Keypair.generate();
  
  let mint: anchor.web3.PublicKey;
  let ownerAta: anchor.web3.PublicKey;
  let beneficiaryAta: anchor.web3.PublicKey;

  const INTERVAL = new anchor.BN(2);
  const GRACE_PERIOD = new anchor.BN(1);
  const DEPOSIT_AMOUNT = new anchor.BN(5000);

  const [vaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.publicKey.toBuffer()],
    program.programId
  );

  const [vaultTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("token_vault"), owner.publicKey.toBuffer()],
    program.programId
  );

  it("Airdrops SOL and sets up SPL Token architecture", async () => {
    const airdropSig = await provider.connection.requestAirdrop(
      owner.publicKey,
      10 * anchor.web3.LAMPORTS_PER_SOL
    );
    const airdropBen = await provider.connection.requestAirdrop(
      beneficiary.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );

    const latestBlockHash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropSig,
    });
    await provider.connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: airdropBen,
    });

    mint = await createMint(provider.connection, owner, owner.publicKey, null, 6);
    ownerAta = await createAssociatedTokenAccount(provider.connection, owner, mint, owner.publicKey);
    beneficiaryAta = await createAssociatedTokenAccount(provider.connection, beneficiary, mint, beneficiary.publicKey);

    await mintTo(provider.connection, owner, mint, ownerAta, owner, 10000);

    const ownerAtaInfo = await getAccount(provider.connection, ownerAta);
    assert.strictEqual(ownerAtaInfo.amount.toString(), "10000");

    console.log(`\n     [SETUP] Initial Token Balances`);
    console.log(`    Owner ATA:       ${ownerAtaInfo.amount.toString()} TOKENS`);
    console.log(`    Beneficiary ATA: 0 TOKENS`);
    console.log(`    Vault PDA:       Doesn't exist yet`);
  });

  it("Initializes the Dead Man's Switch Vault with SPL Tokens", async () => {
    await program.methods
      .initialize(INTERVAL, GRACE_PERIOD, DEPOSIT_AMOUNT)
      .accounts({
        owner: owner.publicKey,
        beneficiary: beneficiary.publicKey,
        mint: mint,
        ownerTokenAccount: ownerAta,
        vaultTokenAccount: vaultTokenAccountPda,
        vaultState: vaultStatePda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAccount = await program.account.vaultState.fetch(vaultStatePda);
    assert.ok(vaultAccount.owner.equals(owner.publicKey));

    const pdaTokenBalance = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalance = await getAccount(provider.connection, ownerAta);
    
    assert.strictEqual(pdaTokenBalance.amount.toString(), DEPOSIT_AMOUNT.toString());
    assert.strictEqual(ownerTokenBalance.amount.toString(), "5000"); 

    console.log(`\n     [INIT] Post-Initialization Balances`);
    console.log(`    Owner ATA:       ${ownerTokenBalance.amount.toString()} TOKENS (-5000)`);
    console.log(`    Vault PDA ATA:   ${pdaTokenBalance.amount.toString()} TOKENS (+5000 locked)`);
  });

  it("Pings the vault to reset the timer", async () => {
    await sleep(1000); 
    const vaultBefore = await program.account.vaultState.fetch(vaultStatePda);

    await program.methods
      .ping()
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAfter = await program.account.vaultState.fetch(vaultStatePda);
    assert.isTrue(vaultAfter.lastPingTime.toNumber() > vaultBefore.lastPingTime.toNumber());

    console.log(`\n     [PING] Keep-Alive Successful`);
    console.log(`    Previous Ping:   ${vaultBefore.lastPingTime.toNumber()}`);
    console.log(`    New Ping:        ${vaultAfter.lastPingTime.toNumber()}`);
  });

  it("Updates the vault interval", async () => {
    const newInterval = new anchor.BN(4);
    
    await program.methods
      .updateInterval(newInterval)
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAfter = await program.account.vaultState.fetch(vaultStatePda);
    assert.ok(vaultAfter.interval.eq(newInterval));
    
    console.log(`\n     [UPDATE] Interval Changed`);
    console.log(`    New Interval:    ${vaultAfter.interval.toNumber()} seconds`);
  });

  it("Cancels the vault and returns SPL tokens to the owner", async () => {
    await program.methods
      .cancelVault()
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
        vaultTokenAccount: vaultTokenAccountPda,
        ownerTokenAccount: ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([owner])
      .rpc();

    const ownerTokenBalance = await getAccount(provider.connection, ownerAta);
    assert.strictEqual(ownerTokenBalance.amount.toString(), "10000"); 

    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePda);
    assert.isNull(vaultStateInfo);

    console.log(`\n     [CANCEL] Vault Teardown & Recovery`);
    console.log(`    Owner ATA:       ${ownerTokenBalance.amount.toString()} TOKENS (+5000 recovered)`);
    console.log(`    Vault PDA:       Memory Swept & Closed`);
  });

  it("Re-initializes the vault to test withdrawal", async () => {
    await program.methods
      .initialize(new anchor.BN(1), new anchor.BN(1), DEPOSIT_AMOUNT)
      .accounts({
        owner: owner.publicKey,
        beneficiary: beneficiary.publicKey,
        mint: mint,
        ownerTokenAccount: ownerAta,
        vaultTokenAccount: vaultTokenAccountPda,
        vaultState: vaultStatePda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([owner])
      .rpc();

    const pdaTokenBalance = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalance = await getAccount(provider.connection, ownerAta);

    console.log(`\n     [RE-INIT] Setup for Withdraw Test`);
    console.log(`    Owner ATA:       ${ownerTokenBalance.amount.toString()} TOKENS (-5000)`);
    console.log(`    Vault PDA ATA:   ${pdaTokenBalance.amount.toString()} TOKENS (+5000 locked)`);
  });

  it("Fails if beneficiary tries to withdraw during interval + grace period", async () => {
    try {
      await program.methods
        .withdraw()
        .accounts({
          beneficiary: beneficiary.publicKey,
          vaultState: vaultStatePda,
          vaultTokenAccount: vaultTokenAccountPda,
          beneficiaryTokenAccount: beneficiaryAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([beneficiary])
        .rpc();
        
      assert.fail("The transaction should have failed!");
    } catch (err) {
      assert.include(err.message, "VaultStillActive");
      console.log(`\n     [WITHDRAW] Early Access Blocked`);
      console.log(`    Status:          Transaction rejected as expected (VaultStillActive)`);
    }
  });

  it("Allows beneficiary to withdraw SPL tokens after interval + grace period", async () => {
    console.log(`\n     [WAIT] Simulating time passage (3 seconds)...`);
    await sleep(3000); 

    await program.methods
      .withdraw()
      .accounts({
        beneficiary: beneficiary.publicKey,
        vaultState: vaultStatePda,
        vaultTokenAccount: vaultTokenAccountPda,
        beneficiaryTokenAccount: beneficiaryAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([beneficiary])
      .rpc();

    const beneficiaryTokenBalance = await getAccount(provider.connection, beneficiaryAta);
    assert.strictEqual(beneficiaryTokenBalance.amount.toString(), DEPOSIT_AMOUNT.toString());

    const vaultTokenAccountInfo = await provider.connection.getAccountInfo(vaultTokenAccountPda);
    assert.isNull(vaultTokenAccountInfo);

    console.log(`\n     [WITHDRAW] Dead Man's Switch Triggered`);
    console.log(`    Beneficiary ATA: ${beneficiaryTokenBalance.amount.toString()} TOKENS (+5000 claimed)`);
    console.log(`    Vault PDA:       Memory Swept & Closed`);
  });
});