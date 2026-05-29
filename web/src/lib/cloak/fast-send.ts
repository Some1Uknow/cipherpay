import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

import { CloakExecutionNotImplementedError } from "@/lib/cloak/execution-errors";

export type CloakSignTransaction = <T extends Transaction | VersionedTransaction>(transaction: T) => Promise<T>;
export type CloakSignMessage = (message: Uint8Array) => Promise<Uint8Array>;

export type FastSendPhase = "deposit-proof" | "deposit-submit" | "withdraw-proof" | "withdraw-submit" | "success";

export type FastSendPrivateSolArgs = {
  amountBaseUnits: bigint;
  recipient: PublicKey;
  sender: PublicKey;
  connection: Connection;
  signTransaction: CloakSignTransaction;
  signMessage: CloakSignMessage;
  onPhase?: (phase: FastSendPhase) => void;
  onProgress?: (message: string) => void;
  onProofProgress?: (percent: number) => void;
};

export type FastSendPrivateSolResult = {
  depositSignature: string;
  withdrawSignature: string;
  depositCommitment?: string;
};

export async function fastSendPrivateSol(args: FastSendPrivateSolArgs): Promise<FastSendPrivateSolResult> {
  void args;
  throw new CloakExecutionNotImplementedError("manual-pay");
}
