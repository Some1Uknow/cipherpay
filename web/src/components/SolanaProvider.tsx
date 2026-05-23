"use client";

import { ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import { publicConfig } from "@/lib/public-config";

import "@solana/wallet-adapter-react-ui/styles.css";

type SolanaProviderProps = {
  children: ReactNode;
};

export function SolanaProvider({ children }: SolanaProviderProps) {
  const endpoint = publicConfig.solanaRpcUrl;

  const wallets = useMemo(() => {
    return [new PhantomWalletAdapter(), new SolflareWalletAdapter()];
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
