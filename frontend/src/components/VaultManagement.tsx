'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { 
  pingVault, 
  depositTokens, 
  ownerWithdraw, 
  updateInterval, 
  updateBeneficiary, 
  cancelVault,
  VaultState 
} from '@/utils/anchor';
import { useAnchorProgram, useTransaction } from '@/hooks/useAnchor';

interface VaultManagementProps {
  vault: VaultState;
  ownerPublicKey: PublicKey;
  onRefresh: () => void;
}

export default function VaultManagement({ vault, ownerPublicKey, onRefresh }: VaultManagementProps) {
  const getProgramFn = useAnchorProgram();
  const { sendTransaction, loading: txLoading, error: txError } = useTransaction();
  
  // States for various forms
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [newInterval, setNewInterval] = useState('');
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000);
      const deadline = vault.lastPingTime.toNumber() + vault.interval.toNumber() + vault.gracePeriod.toNumber();
      setTimeLeft(Math.max(0, deadline - now));
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [vault]);

  const executeAction = async (action: () => Promise<string>, successMsg: string) => {
    setMessage(null);
    try {
      const tx = await action();
      setMessage({ type: 'success', text: `${successMsg}: ${tx}` });
      setTimeout(onRefresh, 2000);
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Transaction failed' });
    }
  };

  const getAta = async (mint: PublicKey, owner: PublicKey) => {
    return getAssociatedTokenAddressSync(mint, owner);
  };

  const handlePing = () => executeAction(
    () => pingVault(getProgramFn(), ownerPublicKey, vault.mint, sendTransaction), 
    'Vault pinged successfully'
  );

  const handleDeposit = async () => {
    if (!depositAmount) return;
    const ata = await getAta(vault.mint, ownerPublicKey);
    executeAction(
      () => depositTokens(getProgramFn(), ownerPublicKey, vault.mint, ata, Number(depositAmount), sendTransaction),
      'Deposit successful'
    );
    setDepositAmount('');
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    const ata = await getAta(vault.mint, ownerPublicKey);
    executeAction(
      () => ownerWithdraw(getProgramFn(), ownerPublicKey, vault.mint, ata, Number(withdrawAmount), sendTransaction),
      'Withdrawal successful'
    );
    setWithdrawAmount('');
  };

  const handleUpdateInterval = () => {
    if (!newInterval) return;
    executeAction(
      () => updateInterval(getProgramFn(), ownerPublicKey, vault.mint, Number(newInterval), sendTransaction),
      'Interval updated'
    );
    setNewInterval('');
  };

  const handleUpdateBeneficiary = () => {
    if (!newBeneficiary) return;
    executeAction(
      () => updateBeneficiary(getProgramFn(), ownerPublicKey, vault.mint, new PublicKey(newBeneficiary), sendTransaction),
      'Beneficiary updated'
    );
    setNewBeneficiary('');
  };

  const handleCancel = async () => {
    if (!window.confirm("WARNING: This will permanently close the vault and return all tokens. Proceed?")) return;
    const ata = await getAta(vault.mint, ownerPublicKey);
    executeAction(
      () => cancelVault(getProgramFn(), ownerPublicKey, vault.mint, ata, sendTransaction),
      'Vault cancelled and memory swept'
    );
  };

  return (
    <div className="border-box">
      <div className="flex justify-between items-center mb-6 border-b-2 border-white pb-4">
        <div>
          <span className="status-indicator status-active"></span>
          <strong>VAULT ACTIVE</strong>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-400">TIME UNTIL TRIGGER</p>
          <p className="text-xl font-bold">{timeLeft > 0 ? `${timeLeft} SECONDS` : 'TRIGGERED'}</p>
        </div>
      </div>

      {message && <div className={`alert ${message.type} mb-4`}>&gt; {message.type.toUpperCase()}: {message.text}</div>}
      {txError && <div className="alert error mb-4">&gt; TX ERROR: {txError}</div>}

      <div className="grid-cols-2 mb-8">
        <div>
          <p className="text-sm text-gray-400 mb-1">BENEFICIARY</p>
          <code className="block truncate mb-4">{vault.beneficiary.toBase58()}</code>
          
          <p className="text-sm text-gray-400 mb-1">TOKEN MINT</p>
          <code className="block truncate">{vault.mint.toBase58()}</code>
        </div>
        <div>
          <p className="text-sm text-gray-400 mb-1">INTERVAL (SEC)</p>
          <p className="mb-4">{vault.interval.toNumber()}</p>
          
          <p className="text-sm text-gray-400 mb-1">GRACE PERIOD (SEC)</p>
          <p>{vault.gracePeriod.toNumber()}</p>
        </div>
      </div>

      <div className="border-t-2 border-white pt-6">
        <h3 className="mt-0">ACTIONS</h3>
        
        <button onClick={handlePing} disabled={txLoading} className="w-full mb-6 py-4 text-lg">
          [ SEND KEEP-ALIVE PING ]
        </button>

        <div className="grid-cols-2 mb-6">
          <div className="border-box-subtle mb-0 p-4">
            <input type="number" placeholder="Amount" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            <button onClick={handleDeposit} disabled={txLoading} className="w-full mt-2">DEPOSIT</button>
          </div>
          <div className="border-box-subtle mb-0 p-4">
            <input type="number" placeholder="Amount" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            <button onClick={handleWithdraw} disabled={txLoading} className="w-full mt-2">WITHDRAW</button>
          </div>
        </div>

        <div className="grid-cols-2 mb-8">
          <div className="border-box-subtle mb-0 p-4">
            <input type="number" placeholder="New Interval (sec)" value={newInterval} onChange={(e) => setNewInterval(e.target.value)} />
            <button onClick={handleUpdateInterval} disabled={txLoading} className="w-full mt-2">UPDATE INTERVAL</button>
          </div>
          <div className="border-box-subtle mb-0 p-4">
            <input type="text" placeholder="New Beneficiary Pubkey" value={newBeneficiary} onChange={(e) => setNewBeneficiary(e.target.value)} />
            <button onClick={handleUpdateBeneficiary} disabled={txLoading} className="w-full mt-2">UPDATE BENEFICIARY</button>
          </div>
        </div>

        <button onClick={handleCancel} disabled={txLoading} className="danger w-full">
          !! CANCEL VAULT & RECOVER FUNDS !!
        </button>
      </div>
    </div>
  );
}
