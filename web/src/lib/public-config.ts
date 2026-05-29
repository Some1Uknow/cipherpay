const privatePayoutDecimals = Number.parseInt(process.env.NEXT_PUBLIC_PRIVATE_PAYOUT_DECIMALS ?? "9", 10);

export const publicConfig = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim(),
  solanaCluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").trim(),
  solanaRpcUrl: (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com").trim(),
  cipherpayProgramId: (process.env.NEXT_PUBLIC_CIPHERPAY_PROGRAM_ID ?? "").trim(),
  payoutRail: (process.env.NEXT_PUBLIC_PAYOUT_RAIL ?? "cloak").trim(),
  cloakProgramId: (
    process.env.NEXT_PUBLIC_CLOAK_PROGRAM_ID ??
    (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? "zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW"
      : "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h")
  ).trim(),
  cloakRelayUrl: (
    process.env.NEXT_PUBLIC_CLOAK_RELAY_URL ??
    (process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "https://api.cloak.ag" : "https://api.devnet.cloak.ag")
  ).trim(),
  privatePayoutMint: (process.env.NEXT_PUBLIC_PRIVATE_PAYOUT_MINT ?? "So11111111111111111111111111111111111111112").trim(),
  privatePayoutSymbol: (process.env.NEXT_PUBLIC_PRIVATE_PAYOUT_SYMBOL ?? "SOL").trim(),
  privatePayoutDecimals: Number.isFinite(privatePayoutDecimals) ? privatePayoutDecimals : 9,
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
