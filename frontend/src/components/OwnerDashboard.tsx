'use client';

import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { useAnchorProgram, useVaultData, useTransaction } from '@/hooks/useAnchor';
import { useState, useEffect } from 'react';
import {
  initializeVault,
  depositTokens,
  ownerWithdraw,
  pingVault,
  updateInterval,
  updateBeneficiary,
  cancelVault,
  getVaultPDA,
} from '@/utils/anchor';
import VaultManagement from './VaultManagement';

interface OwnerDashboardProps {
  ownerPublicKey: PublicKey;
}

export default function OwnerDashboard({ ownerPublicKey }: OwnerDashboardProps) {
  const { connection } = useConnection();
  const getProgramFn = useAnchorProgram();
  const { vault, loading, error, fetchVault } = useVaultData(ownerPublicKey);
  const { sendTransaction, loading: txLoading, error: txError } = useTransaction();

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    mint: '',
    beneficiary: '',
    depositAmount: '',
    interval: '',
    gracePeriod: '',
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch vault on component mount
  useEffect(() => {
    fetchVault();
    const interval = setInterval(fetchVault, 5000);
    return () => clearInterval(interval);
  }, [fetchVault]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitializeVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage(null);

    try {
      const program = getProgramFn();
      
      // Validate inputs
      if (!formData.mint || !formData.beneficiary || !formData.depositAmount) {
        throw new Error('Please fill in all required fields');
      }

      const mintPubkey = new PublicKey(formData.mint);
      const beneficiaryPubkey = new PublicKey(formData.beneficiary);
      const depositAmount = Math.floor(Number(formData.depositAmount));
      const interval = Math.floor(Number(formData.interval) || 86400); // Default 1 day
      const gracePeriod = Math.floor(Number(formData.gracePeriod) || 3600); // Default 1 hour

      // Get owner's token account (ATA)
      const ata = await PublicKey.findProgramAddress(
        [ownerPublicKey.toBuffer(), new PublicKey('TokenkegQfeZyiNwAJsyFbPVwwQQfg5bgDLvotemen').toBuffer(), mintPubkey.toBuffer()],
        new PublicKey('ATokenGPvbdGVqstVQmcLsNZAqeEjlmGnKPH5LedwigJZ')
      );

      const tx = await initializeVault(
        program,
        ownerPublicKey,
        beneficiaryPubkey,
        mintPubkey,
        ata[0],
        interval,
        gracePeriod,
        depositAmount,
        sendTransaction
      );

      setMessage({ type: 'success', text: `Vault initialized: ${tx}` });
      setFormData({ mint: '', beneficiary: '', depositAmount: '', interval: '', gracePeriod: '' });
      setShowForm(false);
      
      // Refresh vault data
      setTimeout(fetchVault, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to initialize vault';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div>
      <h2>OWNER DASHBOARD</h2>

      {error && <div className="alert error mb-4">&gt; ERROR: {error}</div>}
      {message && (
        <div className={`alert ${message.type} mb-4`}>
          &gt; {message.type.toUpperCase()}: {message.text}
        </div>
      )}
      {txError && <div className="alert error mb-4">&gt; TX ERROR: {txError}</div>}

      {!vault ? (
        <>
          {loading ? (
            <div className="border-box">
              <span className="spinner"></span> LOADING VAULT DATA...
            </div>
          ) : (
            <div className="border-box">
              <p className="text-gray-400">NO ACTIVE VAULT DETECTED</p>
              <p className="mt-2 text-sm">Create a new vault to get started.</p>

              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4"
                >
                  CREATE NEW VAULT
                </button>
              )}

              {showForm && (
                <form onSubmit={handleInitializeVault} className="mt-6 border-b-2 border-white pb-6">
                  <div>
                    <label>MINT ADDRESS *</label>
                    <input
                      type="text"
                      name="mint"
                      value={formData.mint}
                      onChange={handleFormChange}
                      placeholder="Mint contract address"
                      required
                    />
                  </div>

                  <div>
                    <label>BENEFICIARY PUBKEY *</label>
                    <input
                      type="text"
                      name="beneficiary"
                      value={formData.beneficiary}
                      onChange={handleFormChange}
                      placeholder="Beneficiary wallet address"
                      required
                    />
                  </div>

                  <div>
                    <label>DEPOSIT AMOUNT (tokens) *</label>
                    <input
                      type="number"
                      name="depositAmount"
                      value={formData.depositAmount}
                      onChange={handleFormChange}
                      placeholder="Amount of tokens"
                      required
                    />
                  </div>

                  <div className="grid-cols-2">
                    <div>
                      <label>INTERVAL (seconds)</label>
                      <input
                        type="number"
                        name="interval"
                        value={formData.interval}
                        onChange={handleFormChange}
                        placeholder="e.g., 86400 for 1 day"
                      />
                    </div>
                    <div>
                      <label>GRACE PERIOD (seconds)</label>
                      <input
                        type="number"
                        name="gracePeriod"
                        value={formData.gracePeriod}
                        onChange={handleFormChange}
                        placeholder="e.g., 3600 for 1 hour"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button type="submit" disabled={submitLoading || txLoading}>
                      {submitLoading || txLoading ? (
                        <>
                          <span className="spinner"></span> INITIALIZING...
                        </>
                      ) : (
                        'INITIALIZE'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={{ border: '2px solid #666666', color: '#666666' }}
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      ) : (
        <VaultManagement
          vault={vault}
          ownerPublicKey={ownerPublicKey}
          onRefresh={fetchVault}
        />
      )}
    </div>
  );
}
