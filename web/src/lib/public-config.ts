export const publicConfig = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim(),
  solanaCluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").trim(),
  solanaRpcUrl: (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com").trim(),
  cipherpayProgramId: (process.env.NEXT_PUBLIC_CIPHERPAY_PROGRAM_ID ?? "").trim(),
  phase1PayoutAsset: "sol",
  phase1TokenMint: "",
  phase1TokenSymbol: "SOL",
  phase1TokenDecimals: 9,
  supportedWallets: (process.env.NEXT_PUBLIC_SUPPORTED_WALLETS ?? "phantom,solflare,backpack")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
} as const;

export type PublicConfig = typeof publicConfig;
