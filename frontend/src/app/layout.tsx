import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { WalletProvider } from '@/components/WalletProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deadman Switch - Inheritance Protocol',
  description: 'A decentralized dead mans switch for Solana token inheritance',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
          <div className="min-h-screen bg-black text-white font-mono">
            {children}
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
