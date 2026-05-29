import { PublicKey } from "@solana/web3.js";

import { publicConfig } from "@/lib/public-config";
import type { PrivatePayoutAsset } from "@/lib/payout-runs/types";

export type CloakCluster = "devnet" | "mainnet-beta";

export const CLOAK_PROGRAM_IDS: Record<CloakCluster, string> = {
  devnet: "Zc1kHfp4rajSMeASFDwFFgkHRjv7dFQuLheJoQus27h",
  "mainnet-beta": "zh1eLd6rSphLejbFfJEneUwzHRfMKxgzrgkfwA6qRkW",
};

export const CLOAK_RELAY_URLS: Record<CloakCluster, string> = {
  devnet: "https://api.devnet.cloak.ag",
  "mainnet-beta": "https://api.cloak.ag",
};

export const SHIELD_DEPOSIT_MIN_LAMPORTS = BigInt(10_000_000);
export const NATIVE_SOL_MINT_ADDRESS = "So11111111111111111111111111111111111111112";

export function getCloakCluster(): CloakCluster {
  return publicConfig.solanaCluster === "mainnet-beta" ? "mainnet-beta" : "devnet";
}

export const cloakConfig = {
  cluster: getCloakCluster(),
  programId: new PublicKey(publicConfig.cloakProgramId || CLOAK_PROGRAM_IDS[getCloakCluster()]),
  relayUrl: publicConfig.cloakRelayUrl || CLOAK_RELAY_URLS[getCloakCluster()],
  nativeSolMint: new PublicKey(NATIVE_SOL_MINT_ADDRESS),
} as const;

export function getPrivatePayoutAsset(): PrivatePayoutAsset {
  return {
    symbol: publicConfig.privatePayoutSymbol === "USDC" ? "USDC" : "SOL",
    mint: publicConfig.privatePayoutMint,
    decimals: publicConfig.privatePayoutDecimals,
    displayName: publicConfig.privatePayoutSymbol === "USDC" ? "USDC" : "Solana",
  };
}

export function isCloakPrivateRailEnabled() {
  return publicConfig.payoutRail === "cloak";
}
