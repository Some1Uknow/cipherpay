import type { CloakCluster } from "@/lib/cloak/config";

export type BatchQueueRowState = "pending" | "in-flight" | "confirmed" | "failed";

export type BatchQueueRow = {
  rowId: string;
  recipient: string;
  amountRaw: string;
  feeRaw: string;
  netRaw: string;
  state: BatchQueueRowState;
  attempts: number;
  payoutSignature?: string;
  errorMessage?: string;
  lastAttemptAt?: number;
  confirmedAt?: number;
};

export type BatchQueueRun = {
  id: string;
  cluster: CloakCluster;
  sender: string;
  mint: string;
  totalRaw: string;
  depositSignature: string;
  createdAt: number;
  updatedAt: number;
  rows: BatchQueueRow[];
};

export const BATCH_QUEUE_STORAGE_PREFIX = "cipherpay:cloak:batch-queue:v1";

