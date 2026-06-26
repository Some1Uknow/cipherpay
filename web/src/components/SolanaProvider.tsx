"use client";

import { ReactNode, useMemo } from "react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

import { publicConfig } from "@/lib/public-config";
import { CIPHERPAY_WALLET_NAME_KEY } from "@/lib/wallet/local-wallet-preference";

import "@solana/wallet-adapter-react-ui/styles.css";

type SolanaProviderProps = {
  children: ReactNode;
};

export function SolanaProvider({ children }: SolanaProviderProps) {
  const endpoint = publicConfig.solanaRpcUrl;
  const walletNetwork =
    publicConfig.solanaCluster === "devnet"
      ? WalletAdapterNetwork.Devnet
      : publicConfig.solanaCluster === "testnet"
        ? WalletAdapterNetwork.Testnet
        : WalletAdapterNetwork.Mainnet;

  const wallets = useMemo(() => {
    return [new PhantomWalletAdapter(), new SolflareWalletAdapter({ network: walletNetwork })];
  }, [walletNetwork]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        localStorageKey={CIPHERPAY_WALLET_NAME_KEY}
        onError={(error) => {
          console.error("[wallet-adapter]", error, "cause" in error ? error.cause : undefined);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
