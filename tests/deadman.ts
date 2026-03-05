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
const DEFAULT_PUBKEY = new anchor.web3.PublicKey("11111111111111111111111111111111");

describe("deadman", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Deadman as Program<Deadman>;

  const owner = (provider.wallet as anchor.Wallet).payer; //i am using the local pubkey instead of generating a new one every time.
  const beneficiary = anchor.web3.Keypair.generate();
  const ownerTwo = anchor.web3.Keypair.generate();
  const beneficiaryTwo = anchor.web3.Keypair.generate();
  const outsider = anchor.web3.Keypair.generate();
  
  let mint: anchor.web3.PublicKey;
  let ownerAta: anchor.web3.PublicKey;
  let beneficiaryAta: anchor.web3.PublicKey;
  let vaultStatePda: anchor.web3.PublicKey;
  let vaultTokenAccountPda: anchor.web3.PublicKey;
  let mintTwo: anchor.web3.PublicKey;
  let wrongMintTwo: anchor.web3.PublicKey;
  let ownerTwoAta: anchor.web3.PublicKey;
  let ownerTwoWrongMintAta: anchor.web3.PublicKey;
  let beneficiaryTwoAta: anchor.web3.PublicKey;
  let outsiderAta: anchor.web3.PublicKey;
  let vaultStatePdaTwo: anchor.web3.PublicKey;
  let vaultTokenAccountPdaTwo: anchor.web3.PublicKey;

  const INTERVAL = new anchor.BN(2);
  const GRACE_PERIOD = new anchor.BN(1);
  const DEPOSIT_AMOUNT = new anchor.BN(5000);

  it("Funds accounts and sets up SPL Token architecture", async () => {
    // Transfer 0.5 SOL directly from the owner to the beneficiary to cover their gas fees
    const transferTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: beneficiary.publicKey,
        lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    
    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      transferTx,
      [owner]
    );

    mint = await createMint(provider.connection, owner, owner.publicKey, null, 6);
    
    [vaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), owner.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

    [vaultTokenAccountPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), owner.publicKey.toBuffer(), mint.toBuffer()],
      program.programId
    );

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

  it("Updates the beneficiary to a new wallet", async () => {
    const newBeneficiary = anchor.web3.Keypair.generate();
    const vaultBefore = await program.account.vaultState.fetch(vaultStatePda);
    
    await program.methods
      .updateBeneficiary(newBeneficiary.publicKey)
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
      } as any)
      .signers([owner])
      .rpc();

    const vaultAfter = await program.account.vaultState.fetch(vaultStatePda);
    assert.ok(vaultAfter.beneficiary.equals(newBeneficiary.publicKey));
    assert.ok(!vaultAfter.beneficiary.equals(vaultBefore.beneficiary));
    
    console.log(`\n     [UPDATE] Beneficiary Changed`);
    console.log(`    Old Beneficiary: ${vaultBefore.beneficiary.toBase58().slice(0, 8)}...`);
    console.log(`    New Beneficiary: ${vaultAfter.beneficiary.toBase58().slice(0, 8)}...`);
    
    await program.methods
      .updateBeneficiary(beneficiary.publicKey)
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
      } as any)
      .signers([owner])
      .rpc();
  });

  it("Deposits additional tokens into the vault (top-up)", async () => {
    const depositAmount = new anchor.BN(2000);
    
    const vaultTokenBalanceBefore = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalanceBefore = await getAccount(provider.connection, ownerAta);
    
    await program.methods
      .deposit(depositAmount)
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
        ownerTokenAccount: ownerAta,
        vaultTokenAccount: vaultTokenAccountPda,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([owner])
      .rpc();

    const vaultTokenBalanceAfter = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalanceAfter = await getAccount(provider.connection, ownerAta);
    
    assert.strictEqual(
      vaultTokenBalanceAfter.amount.toString(),
      (Number(vaultTokenBalanceBefore.amount) + depositAmount.toNumber()).toString()
    );
    assert.strictEqual(
      ownerTokenBalanceAfter.amount.toString(),
      (Number(ownerTokenBalanceBefore.amount) - depositAmount.toNumber()).toString()
    );
    
    console.log(`\n     [DEPOSIT] Top-Up Successful`);
    console.log(`    Owner ATA:       ${ownerTokenBalanceAfter.amount.toString()} TOKENS (-${depositAmount.toNumber()})`);
    console.log(`    Vault PDA ATA:   ${vaultTokenBalanceAfter.amount.toString()} TOKENS (+${depositAmount.toNumber()})`);
  });

  it("Allows owner to make a partial withdrawal from the vault", async () => {
    const withdrawAmount = new anchor.BN(1500);
    
    const vaultTokenBalanceBefore = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalanceBefore = await getAccount(provider.connection, ownerAta);
    
    await program.methods
      .ownerWithdraw(withdrawAmount)
      .accounts({
        owner: owner.publicKey,
        vaultState: vaultStatePda,
        vaultTokenAccount: vaultTokenAccountPda,
        ownerTokenAccount: ownerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([owner])
      .rpc();

    const vaultTokenBalanceAfter = await getAccount(provider.connection, vaultTokenAccountPda);
    const ownerTokenBalanceAfter = await getAccount(provider.connection, ownerAta);
    
    const vaultState = await program.account.vaultState.fetch(vaultStatePda);
    assert.ok(vaultState.owner.equals(owner.publicKey));
    
    assert.strictEqual(
      vaultTokenBalanceAfter.amount.toString(),
      (Number(vaultTokenBalanceBefore.amount) - withdrawAmount.toNumber()).toString()
    );
    assert.strictEqual(
      ownerTokenBalanceAfter.amount.toString(),
      (Number(ownerTokenBalanceBefore.amount) + withdrawAmount.toNumber()).toString()
    );
    
    console.log(`\n     [OWNER_WITHDRAW] Partial Withdrawal Successful`);
    console.log(`    Owner ATA:       ${ownerTokenBalanceAfter.amount.toString()} TOKENS (+${withdrawAmount.toNumber()})`);
    console.log(`    Vault PDA ATA:   ${vaultTokenBalanceAfter.amount.toString()} TOKENS (-${withdrawAmount.toNumber()})`);
    console.log(`    Vault Status:    Still Active & Operational`);
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

  it("Sets up secondary actors and token accounts for constraint tests", async () => {
    // transfer SOL from main CLI wallet to fund the secondary test wallets
    const fundSecondaryTx = new anchor.web3.Transaction().add(
      anchor.web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: ownerTwo.publicKey,
        lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: beneficiaryTwo.publicKey,
        lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
      }),
      anchor.web3.SystemProgram.transfer({
        fromPubkey: owner.publicKey,
        toPubkey: outsider.publicKey,
        lamports: 0.5 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );

    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      fundSecondaryTx,
      [owner] 
    );

    mintTwo = await createMint(
      provider.connection,
      ownerTwo,
      ownerTwo.publicKey,
      null,
      6
    );
    wrongMintTwo = await createMint(
      provider.connection,
      ownerTwo,
      ownerTwo.publicKey,
      null,
      6
    );

    ownerTwoAta = await createAssociatedTokenAccount(
      provider.connection,
      ownerTwo,
      mintTwo,
      ownerTwo.publicKey
    );
    ownerTwoWrongMintAta = await createAssociatedTokenAccount(
      provider.connection,
      ownerTwo,
      wrongMintTwo,
      ownerTwo.publicKey
    );
    beneficiaryTwoAta = await createAssociatedTokenAccount(
      provider.connection,
      beneficiaryTwo,
      mintTwo,
      beneficiaryTwo.publicKey
    );
    outsiderAta = await createAssociatedTokenAccount(
      provider.connection,
      outsider,
      mintTwo,
      outsider.publicKey
    );

    [vaultStatePdaTwo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), ownerTwo.publicKey.toBuffer(), mintTwo.toBuffer()],
      program.programId
    );
    [vaultTokenAccountPdaTwo] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("token_vault"), ownerTwo.publicKey.toBuffer(), mintTwo.toBuffer()],
      program.programId
    );

    await mintTo(provider.connection, ownerTwo, mintTwo, ownerTwoAta, ownerTwo, 10_000);
    await mintTo(
      provider.connection,
      ownerTwo,
      wrongMintTwo,
      ownerTwoWrongMintAta,
      ownerTwo,
      10_000
    );
  });

  it("Rejects initialize when interval is zero", async () => {
    try {
      await program.methods
        .initialize(new anchor.BN(0), new anchor.BN(1), new anchor.BN(1000))
        .accounts({
          owner: ownerTwo.publicKey,
          beneficiary: beneficiaryTwo.publicKey,
          mint: mintTwo,
          ownerTokenAccount: ownerTwoAta,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          vaultState: vaultStatePdaTwo,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("initialize with zero interval should fail");
    } catch (err) {
      assert.include((err as Error).message, "InvalidInterval");
    }
  });

  it("Rejects initialize when grace period is zero", async () => {
    try {
      await program.methods
        .initialize(new anchor.BN(1), new anchor.BN(0), new anchor.BN(1000))
        .accounts({
          owner: ownerTwo.publicKey,
          beneficiary: beneficiaryTwo.publicKey,
          mint: mintTwo,
          ownerTokenAccount: ownerTwoAta,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          vaultState: vaultStatePdaTwo,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("initialize with zero grace period should fail");
    } catch (err) {
      assert.include((err as Error).message, "InvalidGracePeriod");
    }
  });

  it("Rejects initialize when beneficiary is default pubkey", async () => {
    try {
      await program.methods
        .initialize(new anchor.BN(1), new anchor.BN(1), new anchor.BN(1000))
        .accounts({
          owner: ownerTwo.publicKey,
          beneficiary: DEFAULT_PUBKEY,
          mint: mintTwo,
          ownerTokenAccount: ownerTwoAta,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          vaultState: vaultStatePdaTwo,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("initialize with default beneficiary should fail");
    } catch (err) {
      assert.include((err as Error).message, "InvalidBeneficiary");
    }
  });

  it("Initializes secondary vault for constraint checks", async () => {
    await program.methods
      .initialize(new anchor.BN(2), new anchor.BN(1), new anchor.BN(3000))
      .accounts({
        owner: ownerTwo.publicKey,
        beneficiary: beneficiaryTwo.publicKey,
        mint: mintTwo,
        ownerTokenAccount: ownerTwoAta,
        vaultTokenAccount: vaultTokenAccountPdaTwo,
        vaultState: vaultStatePdaTwo,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      } as any)
      .signers([ownerTwo])
      .rpc();

    const vaultAccount = await program.account.vaultState.fetch(vaultStatePdaTwo);
    assert.ok(vaultAccount.owner.equals(ownerTwo.publicKey));
  });

  it("Rejects updateInterval when new interval is zero", async () => {
    try {
      await program.methods
        .updateInterval(new anchor.BN(0))
        .accounts({
          owner: ownerTwo.publicKey,
          vaultState: vaultStatePdaTwo,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("updateInterval with zero should fail");
    } catch (err) {
      assert.include((err as Error).message, "InvalidInterval");
    }
  });

  it("Rejects updateBeneficiary when new beneficiary is default pubkey", async () => {
    try {
      await program.methods
        .updateBeneficiary(DEFAULT_PUBKEY)
        .accounts({
          owner: ownerTwo.publicKey,
          vaultState: vaultStatePdaTwo,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("updateBeneficiary with default pubkey should fail");
    } catch (err) {
      assert.include((err as Error).message, "InvalidBeneficiary");
    }
  });

  it("Rejects deposit when owner token account mint does not match vault mint", async () => {
    try {
      await program.methods
        .deposit(new anchor.BN(100))
        .accounts({
          owner: ownerTwo.publicKey,
          vaultState: vaultStatePdaTwo,
          ownerTokenAccount: ownerTwoWrongMintAta,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("deposit with wrong mint token account should fail");
    } catch (err) {
      assert.include((err as Error).message, "ConstraintRaw");
    }
  });

  it("Rejects ownerWithdraw when destination token account mint does not match vault mint", async () => {
    try {
      await program.methods
        .ownerWithdraw(new anchor.BN(100))
        .accounts({
          owner: ownerTwo.publicKey,
          vaultState: vaultStatePdaTwo,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          ownerTokenAccount: ownerTwoWrongMintAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([ownerTwo])
        .rpc();
      assert.fail("ownerWithdraw with wrong mint token account should fail");
    } catch (err) {
      assert.include((err as Error).message, "ConstraintRaw");
    }
  });

  it("Rejects withdraw when beneficiary token account is not owned by beneficiary signer", async () => {
    try {
      await program.methods
        .withdraw()
        .accounts({
          beneficiary: beneficiaryTwo.publicKey,
          vaultState: vaultStatePdaTwo,
          vaultTokenAccount: vaultTokenAccountPdaTwo,
          beneficiaryTokenAccount: outsiderAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        } as any)
        .signers([beneficiaryTwo])
        .rpc();
      assert.fail("withdraw with outsider token account should fail");
    } catch (err) {
      assert.include((err as Error).message, "ConstraintRaw");
    }
  });

  it("Cancels secondary vault and recovers remaining tokens", async () => {
    await program.methods
      .cancelVault()
      .accounts({
        owner: ownerTwo.publicKey,
        vaultState: vaultStatePdaTwo,
        vaultTokenAccount: vaultTokenAccountPdaTwo,
        ownerTokenAccount: ownerTwoAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      } as any)
      .signers([ownerTwo])
      .rpc();

    const vaultStateInfo = await provider.connection.getAccountInfo(vaultStatePdaTwo);
    assert.isNull(vaultStateInfo);
    const vaultTokenAccountInfo = await provider.connection.getAccountInfo(vaultTokenAccountPdaTwo);
    assert.isNull(vaultTokenAccountInfo);
  });
});
