'use client';

import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import { useAnchorProgram, useVaultData, useTransaction } from '@/hooks/useAnchor';
import { useState, useEffect } from 'react';
import { initializeVault } from '@/utils/anchor';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import VaultManagement from './VaultManagement';

interface OwnerDashboardProps {
  ownerPublicKey: PublicKey;
}

export default function OwnerDashboard({ ownerPublicKey }: OwnerDashboardProps) {
  const { connection } = useConnection();
  const getProgramFn = useAnchorProgram();
  const { vault, loading, error, fetchVault } = useVaultData(ownerPublicKey);
  const { sendTransaction, loading: txLoading, error: txError } = useTransaction();

  const [showForm, setShowForm] = useState(false);
  const [userTokens, setUserTokens] = useState<{ mint: string, balance: number }[]>([]);
  const [fetchingTokens, setFetchingTokens] = useState(false);
  
  const [formData, setFormData] = useState({
    mint: '',
    beneficiary: '',
    depositAmount: '',
    interval: '',
    gracePeriod: '',
  });
  
  const [submitLoading, setSubmitLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch vault only once on mount, no annoying polling
  useEffect(() => {
    fetchVault();
  }, [fetchVault]);

  // Scans the wallet for tokens when the user opens the form
  const scanWalletForTokens = async () => {
    setFetchingTokens(true);
    try {
      const parsedTokenAccounts = await connection.getParsedTokenAccountsByOwner(
        ownerPublicKey,
        { programId: TOKEN_PROGRAM_ID }
      );
      
      const tokens = parsedTokenAccounts.value.map(tokenAccountInfo => {
        const accountData = tokenAccountInfo.account.data.parsed.info;
        return {
          mint: accountData.mint,
          balance: accountData.tokenAmount.uiAmount,
        };
      }).filter(t => t.balance > 0); // Only show tokens they actually own
      
      setUserTokens(tokens);
      if (tokens.length > 0) {
        setFormData(prev => ({ ...prev, mint: tokens[0].mint }));
      }
    } catch (err) {
      console.error("Error scanning tokens:", err);
    } finally {
      setFetchingTokens(false);
    }
  };

  const handleOpenForm = () => {
    setShowForm(true);
    scanWalletForTokens();
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleInitializeVault = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setMessage(null);

    try {
      const program = getProgramFn();
      
      if (!formData.mint || !formData.beneficiary || !formData.depositAmount) {
        throw new Error('Please fill in all required fields');
      }

      const mintPubkey = new PublicKey(formData.mint);
      const beneficiaryPubkey = new PublicKey(formData.beneficiary);
      
     
      const depositAmountRaw = Math.floor(Number(formData.depositAmount) * 1_000_000); 
      const interval = Math.floor(Number(formData.interval) || 86400); 
      const gracePeriod = Math.floor(Number(formData.gracePeriod) || 3600); 

      const ata = getAssociatedTokenAddressSync(mintPubkey, ownerPublicKey);

      const tx = await initializeVault(
        program,
        ownerPublicKey,
        beneficiaryPubkey,
        mintPubkey,
        ata,
        interval,
        gracePeriod,
        depositAmountRaw,
        sendTransaction
      );

      setMessage({ type: 'success', text: `Vault initialized: ${tx}` });
      setFormData({ mint: '', beneficiary: '', depositAmount: '', interval: '', gracePeriod: '' });
      setShowForm(false);
      
      setTimeout(fetchVault, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to initialize vault' });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div>
      <h2>VAULT CONTROL</h2>

      {error && <div className="alert error mb-4">&gt; ERROR: {error}</div>}
      {message && <div className={`alert ${message.type} mb-4`}>&gt; {message.type.toUpperCase()}: {message.text}</div>}
      {txError && <div className="alert error mb-4">&gt; TX ERROR: {txError}</div>}

      {!vault ? (
        <div className="border-box">
          <p className="text-gray-400">NO ACTIVE VAULT DETECTED</p>

          {!showForm && (
            <button onClick={handleOpenForm} className="mt-4">
              [ CREATE NEW VAULT ]
            </button>
          )}

          {showForm && (
            <form onSubmit={handleInitializeVault} className="mt-6 border-t-2 border-white pt-6">
              
              {/* NEW AUTO-FETCH TOKEN UX */}
              <div>
                <label>ASSET TO LOCK *</label>
                {fetchingTokens ? (
                  <p className="mb-4 text-sm"><span className="spinner"></span> SCANNING WALLET...</p>
                ) : userTokens.length > 0 ? (
                  <select name="mint" value={formData.mint} onChange={handleFormChange} className="mb-4 w-full bg-black text-white border border-gray-700 p-3 font-mono" required>
                    {userTokens.map(t => (
                      <option key={t.mint} value={t.mint}>
                        Token: {t.mint.slice(0, 8)}... | Available Balance: {t.balance}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input type="text" name="mint" value={formData.mint} onChange={handleFormChange} placeholder="No tokens found in wallet. Paste mint manually." required />
                )}
              </div>

              <div>
                <label>BENEFICIARY WALLET *</label>
                <input type="text" name="beneficiary" value={formData.beneficiary} onChange={handleFormChange} placeholder="Enter destination pubkey" required />
              </div>

              <div>
                <label>DEPOSIT AMOUNT *</label>
                <input type="number" step="any" name="depositAmount" value={formData.depositAmount} onChange={handleFormChange} placeholder="e.g. 100" required />
              </div>

              <div className="grid-cols-2">
                <div>
                  <label>CHECK-IN INTERVAL (SEC)</label>
                  <input type="number" name="interval" value={formData.interval} onChange={handleFormChange} placeholder="Default: 86400 (1 day)" />
                </div>
                <div>
                  <label>GRACE PERIOD (SEC)</label>
                  <input type="number" name="gracePeriod" value={formData.gracePeriod} onChange={handleFormChange} placeholder="Default: 3600 (1 hour)" />
                </div>
              </div>

              <div className="flex gap-4 mt-4">
                <button type="submit" disabled={submitLoading || txLoading} className="w-full">
                  {submitLoading || txLoading ? 'INITIALIZING...' : 'LOCK VAULT'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} style={{ border: '2px solid #666', color: '#666' }}>
                  CANCEL
                </button>
              </div>
            </form>
          )}
        </div>
      ) : (
        <VaultManagement vault={vault} ownerPublicKey={ownerPublicKey} onRefresh={fetchVault} />
      )}
    </div>
  );
}
