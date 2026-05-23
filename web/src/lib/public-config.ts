export const publicConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  solanaCluster: process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet",
  solanaRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
  phase1TokenMint: process.env.NEXT_PUBLIC_PHASE1_TOKEN_MINT ?? "",
  phase1TokenSymbol: process.env.NEXT_PUBLIC_PHASE1_TOKEN_SYMBOL ?? "USDC",
  phase1TokenDecimals: Number.parseInt(process.env.NEXT_PUBLIC_PHASE1_TOKEN_DECIMALS ?? "6", 10),
  supportedWallets: (process.env.NEXT_PUBLIC_SUPPORTED_WALLETS ?? "phantom,solflare,backpack")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
} as const;

export type PublicConfig = typeof publicConfig;
