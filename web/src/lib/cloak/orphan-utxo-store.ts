import type { CloakCluster } from "@/lib/cloak/config";
import type { SerializedCloakUtxo } from "@/lib/cloak/utxo-serde";

export type OrphanUtxoRecord = {
  id: string;
  cluster: CloakCluster;
  sender: string;
  utxo: SerializedCloakUtxo;
  totalRaw: string;
  mint: string;
  rowsRemaining: number;
  createdAt: number;
  depositSignature: string;
};

export const ORPHAN_UTXO_STORAGE_PREFIX = "cipherpay:cloak:orphan-utxo:v1";

