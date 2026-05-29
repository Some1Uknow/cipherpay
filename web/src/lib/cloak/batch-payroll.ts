import type { Connection, PublicKey } from "@solana/web3.js";

import type { CloakSignMessage, CloakSignTransaction } from "@/lib/cloak/fast-send";
import { CloakExecutionNotImplementedError } from "@/lib/cloak/execution-errors";

export type BatchRowInput = {
  id: string;
  position: number;
  recipient: string;
  amountBaseUnits: bigint;
  feeBaseUnits: bigint;
  netBaseUnits: bigint;
};

export type BatchProgressEvent =
  | { type: "deposit"; phase: "proof" | "submit" | "confirmed"; message?: string; proofPercent?: number }
  | { type: "row"; rowId: string; phase: "proof" | "submit" | "confirmed" | "failed"; message?: string; proofPercent?: number };

export type PersistCloakRunStatus = (event: {
  privateDepositSignature?: string | null;
  currentChangeUtxoCommitment?: string | null;
  rows?: Array<{
    id: string;
    privateWithdrawSignature?: string | null;
    rowStatus: "queued" | "paying" | "paid_private" | "failed";
    privateStatus?: string | null;
    errorMessage?: string | null;
  }>;
}) => Promise<void>;

export type RunCloakBatchPayrollArgs = {
  runId: string;
  rows: BatchRowInput[];
  mint: PublicKey;
  sender: PublicKey;
  connection: Connection;
  signTransaction: CloakSignTransaction;
  signMessage: CloakSignMessage;
  persistRunStatus: PersistCloakRunStatus;
  onProgress?: (event: BatchProgressEvent) => void;
};

export type BatchPayrollResult = {
  confirmed: number;
  failed: number;
  total: number;
  depositSignature: string | null;
  runId: string;
};

export async function runCloakBatchPayroll(args: RunCloakBatchPayrollArgs): Promise<BatchPayrollResult> {
  void args;
  throw new CloakExecutionNotImplementedError("bulk-pay");
}
