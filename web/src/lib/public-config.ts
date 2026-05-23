export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  supportedWallets: (process.env.NEXT_PUBLIC_SUPPORTED_WALLETS ?? "phantom,solflare,backpack")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
} as const;

export type PublicConfig = typeof publicConfig;
