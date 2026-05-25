import { publicConfig } from "@/lib/public-config";
import type { PrivatePayoutAsset } from "@/lib/payout-runs/types";

export const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

export function getPrivatePayoutAsset(): PrivatePayoutAsset {
  const symbol = publicConfig.privatePayoutSymbol === "USDC" ? "USDC" : "SOL";

  return {
    symbol,
    mint: publicConfig.privatePayoutMint,
    decimals: publicConfig.privatePayoutDecimals,
    displayName: symbol === "SOL" ? "SOL-equivalent private payouts" : "USDC private payouts",
    fundingBehavior: publicConfig.privatePayoutMint === SOL_NATIVE_MINT ? "wrap_native_sol" : "spl_token",
  };
}

export function isMagicBlockPrivateRailEnabled() {
  return publicConfig.payoutRail === "magicblock_private_spl";
}
