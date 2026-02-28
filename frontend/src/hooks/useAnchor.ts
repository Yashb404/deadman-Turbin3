'use client';

import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import * as anchor from '@coral-xyz/anchor';
import { useCallback, useState } from 'react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  getProgram,
  VaultState,
} from '@/utils/anchor';

export const useAnchorProgram = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  return useCallback(() => {
    if (!wallet) throw new Error('Wallet not connected');
    
    const provider = new anchor.AnchorProvider(
      connection,
      wallet,
      anchor.AnchorProvider.defaultOptions()
    );
    
    return getProgram(provider);
  }, [wallet, connection]);
};

export const useVaultData = (owner: PublicKey | null) => {
  const [vault, setVault] = useState<VaultState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const getProgramFn = useAnchorProgram();

  const fetchVault = useCallback(async () => {
    if (!owner || !wallet) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const program = getProgramFn();
      // Owners can have multiple vaults (one per mint). The dashboard currently shows the first.
      const ownerVaults = await program.account.vaultState.all([
        { memcmp: { offset: 8, bytes: owner.toBase58() } },
      ]);

      if (ownerVaults.length > 0) {
        const firstVault = ownerVaults[0].account as unknown as VaultState;
        setVault(firstVault);
      } else {
        setVault(null);
      }
    } catch (err) {
      console.error('Error fetching vault:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch vault');
      setVault(null);
    } finally {
      setLoading(false);
    }
  }, [owner, wallet, getProgramFn]);

  return { vault, loading, error, fetchVault };
};

export const useTransaction = () => {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendTransaction = useCallback(
    async (transaction: Transaction) => {
      if (!wallet) {
        throw new Error('Wallet not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = wallet.publicKey;

        const signedTx = await wallet.signTransaction(transaction);
        const serialized = signedTx.serialize();
        const signature = await connection.sendRawTransaction(serialized);

        await connection.confirmTransaction(signature, 'processed');
        return signature;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Transaction failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [wallet, connection]
  );

  return { sendTransaction, loading, error };
};
