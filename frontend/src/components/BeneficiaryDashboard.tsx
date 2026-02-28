'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { useAnchorProgram, useTransaction } from '@/hooks/useAnchor';
import { claimInheritance, VaultState } from '@/utils/anchor';

interface BeneficiaryDashboardProps {
  beneficiaryPublicKey: PublicKey;
}

interface FoundVault {
  publicKey: PublicKey;
  account: VaultState;
}

export default function BeneficiaryDashboard({ beneficiaryPublicKey }: BeneficiaryDashboardProps) {
  const getProgramFn = useAnchorProgram();
  const { sendTransaction, loading: txLoading } = useTransaction();
  
  const [vaults, setVaults] = useState<FoundVault[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBeneficiaryVaults = async () => {
    setLoading(true);
    setError(null);
    try {
      const program = getProgramFn();
      // beneficiary offset = 8-byte discriminator + 32-byte owner field
      const vaultsFound = await program.account.vaultState.all([
        { memcmp: { offset: 40, bytes: beneficiaryPublicKey.toBase58() } }
      ]);
      setVaults(vaultsFound as unknown as FoundVault[]);
    } catch (err) {
      console.error("Error fetching beneficiary vaults:", err);
      setError("Failed to fetch inbound inheritance vaults.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBeneficiaryVaults();
  }, [beneficiaryPublicKey]);

  const handleClaim = async (vault: FoundVault) => {
    setMessage(null);
    try {
      const program = getProgramFn();
      
      const ata = getAssociatedTokenAddressSync(vault.account.mint, beneficiaryPublicKey);

      const tx = await claimInheritance(
        program,
        beneficiaryPublicKey,
        ata,
        vault.publicKey,
        vault.account.owner,
        vault.account.mint,
        sendTransaction
      );
      
      setMessage({ type: 'success', text: `Inheritance claimed successfully: ${tx}` });
      setTimeout(fetchBeneficiaryVaults, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Claim failed' });
    }
  };

  const isTriggered = (vaultData: VaultState) => {
    const now = Math.floor(Date.now() / 1000);
    const deadline = vaultData.lastPingTime.toNumber() + vaultData.interval.toNumber() + vaultData.gracePeriod.toNumber();
    return now > deadline;
  };

  return (
    <div className="mt-12">
      <h2>BENEFICIARY DASHBOARD</h2>
      
      {error && <div className="alert error mb-4">&gt; ERROR: {error}</div>}
      {message && <div className={`alert ${message.type} mb-4`}>&gt; {message.type.toUpperCase()}: {message.text}</div>}

      {loading && vaults.length === 0 ? (
        <div className="border-box"><span className="spinner"></span> SCANNING NETWORK FOR INBOUND VAULTS...</div>
      ) : vaults.length === 0 ? (
        <div className="border-box">
          <p className="text-gray-400">NO INBOUND INHERITANCE DETECTED</p>
          <p className="mt-2 text-sm">Your wallet is not listed as a beneficiary on any active vaults.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {vaults.map((vault) => {
            const triggered = isTriggered(vault.account);
            
            return (
              <div key={vault.publicKey.toBase58()} className="border-box-subtle">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">VAULT OWNER</p>
                    <code className="block">{vault.account.owner.toBase58()}</code>
                  </div>
                  <div>
                    <span className={`status-indicator ${triggered ? 'status-active' : 'status-inactive'}`}></span>
                    <strong>{triggered ? 'UNLOCKED' : 'LOCKED'}</strong>
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-400 mb-1">TOKEN MINT</p>
                  <code className="block">{vault.account.mint.toBase58()}</code>
                </div>

                <button 
                  onClick={() => handleClaim(vault)} 
                  disabled={!triggered || txLoading}
                  className={triggered ? "success w-full" : "w-full"}
                >
                  {txLoading ? 'PROCESSING...' : triggered ? '[ CLAIM INHERITANCE ]' : 'VAULT STILL ACTIVE'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
