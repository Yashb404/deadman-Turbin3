'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useEffect, useState } from 'react';
import OwnerDashboard from '@/components/OwnerDashboard';
import BeneficiaryDashboard from '@/components/BeneficiaryDashboard';

export default function Home() {
  const { publicKey, connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b-2 border-white p-6">
        <div className="container flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-wider">DEADMAN SWITCH</h1>
            <p className="text-sm text-gray-400 mt-1 tracking-widest">INHERITANCE PROTOCOL</p>
          </div>
          <WalletMultiButton />
        </div>
      </header>

      <main className="container py-8">
        {!connected || !publicKey ? (
          <div className="border-box">
            <h2>CONNECT WALLET</h2>
            <p className="mt-4">
              Please connect your Solana wallet to access the Deadman Switch dashboard.
            </p>
            <p className="mt-4 text-sm text-gray-500">
              &gt; AWAITING WALLET CONNECTION...
            </p>
          </div>
        ) : (
          <div>
            <div className="border-box-subtle mb-8">
              <p className="text-sm text-gray-400">CONNECTED WALLET</p>
              <code className="block mt-2 break-all">{publicKey.toBase58()}</code>
            </div>

            <div className="mb-8">
              <OwnerDashboard ownerPublicKey={publicKey} />
            </div>

            <div>
              <BeneficiaryDashboard beneficiaryPublicKey={publicKey} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t-2 border-white mt-16 p-6 text-center text-sm text-gray-500">
        <p>© 2024 DEADMAN SWITCH | DECENTRALIZED INHERITANCE PROTOCOL</p>
      </footer>
    </div>
  );
}
