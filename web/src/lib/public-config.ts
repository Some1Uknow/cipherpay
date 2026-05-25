const privatePayoutDecimals = Number.parseInt(process.env.NEXT_PUBLIC_PRIVATE_PAYOUT_DECIMALS ?? "9", 10);

export const publicConfig = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim(),
  solanaCluster: (process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").trim(),
  solanaRpcUrl: (process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com").trim(),
  cipherpayProgramId: (process.env.NEXT_PUBLIC_CIPHERPAY_PROGRAM_ID ?? "").trim(),
  payoutRail: (process.env.NEXT_PUBLIC_PAYOUT_RAIL ?? "magicblock_private_spl").trim(),
  magicblockPaymentsApi: (process.env.NEXT_PUBLIC_MAGICBLOCK_PAYMENTS_API ?? "https://payments.magicblock.app").trim(),
  magicblockCluster: (process.env.NEXT_PUBLIC_MAGICBLOCK_CLUSTER ?? "devnet").trim(),
  magicblockEphemeralRpcUrl: (process.env.NEXT_PUBLIC_MAGICBLOCK_EPHEMERAL_RPC_URL ?? "https://devnet.magicblock.app").trim(),
  magicblockEphemeralWsUrl: (process.env.NEXT_PUBLIC_MAGICBLOCK_EPHEMERAL_WS_URL ?? "wss://devnet.magicblock.app").trim(),
  magicblockBaseRpcUrl: (process.env.NEXT_PUBLIC_MAGICBLOCK_BASE_RPC_URL ?? "https://api.devnet.solana.com").trim(),
  magicblockValidator: (process.env.NEXT_PUBLIC_MAGICBLOCK_VALIDATOR ?? "MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57").trim(),
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
