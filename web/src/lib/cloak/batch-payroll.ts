import { PublicKey, type Connection } from "@solana/web3.js";
import type { MerkleTree, TransactResult, Utxo } from "@cloak.dev/sdk";

import { applyBufferPolyfill } from "@/lib/buffer-polyfill";
import { cloakConfig } from "@/lib/cloak/config";
import { normalizeCloakError } from "@/lib/cloak/errors";
import { isRetryableWithdrawError, isSubmittingStatus, type CloakSignMessage, type CloakSignTransaction } from "@/lib/cloak/fast-send";
import { loadMerkleTreeCache, saveMerkleTreeCache } from "@/lib/cloak/merkle-tree-cache";
import { loadCloakRelayAlt } from "@/lib/cloak/relay-alt";
import { createMemoizedSignMessage } from "@/lib/cloak/sign-message-cache";

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
  | {
      type: "row";
      rowId: string;
      position: number;
      phase: "queued" | "proof" | "submit" | "confirmed" | "failed";
      message?: string;
      proofPercent?: number;
      signature?: string;
      errorMessage?: string;
    };

export type PersistCloakRunStatus = (event: {
  status?: "depositing" | "deposit_confirmed" | "paying" | "partially_paid" | "completed" | "failed" | "recoverable";
  privateDepositSignature?: string | null;
  privateStatus?: string | null;
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

const RELAY_SETTLE_DELAY_MS = 4000;
const STALE_RETRY_MAX = 2;
const STALE_RETRY_DELAY_MS = 4000;

export async function runCloakBatchPayroll(args: RunCloakBatchPayrollArgs): Promise<BatchPayrollResult> {
  applyBufferPolyfill();

  if (args.rows.length === 0) {
    return {
      confirmed: 0,
      failed: 0,
      total: 0,
      depositSignature: null,
      runId: args.runId,
    };
  }

  const {
    createUtxo,
    createZeroUtxo,
    generateUtxoKeypair,
    isRootNotFoundError,
    partialWithdraw,
    transact,
  } = await import("@cloak.dev/sdk");

  const memoizedSignMessage = createMemoizedSignMessage(args.signMessage);
  const total = args.rows.reduce((sum, row) => sum + row.amountBaseUnits, BigInt(0));
  const cachedTreeForDeposit = await loadMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId);
  const addressLookupTableAccounts = await loadCloakRelayAlt(args.connection, cloakConfig.relayUrl);

  let depositResult: TransactResult;
  try {
    args.onProgress?.({ type: "deposit", phase: "proof", message: "Generating one private deposit for the batch", proofPercent: 0 });

    const ephemeralKeypair = await generateUtxoKeypair();
    const depositOutput = await createUtxo(total, ephemeralKeypair, args.mint);
    let inSubmitPhase = false;

    depositResult = await transact(
      {
        inputUtxos: [await createZeroUtxo(args.mint)],
        outputUtxos: [depositOutput],
        externalAmount: total,
        depositor: args.sender,
      },
      {
        connection: args.connection,
        programId: cloakConfig.programId,
        relayUrl: cloakConfig.relayUrl,
        depositorPublicKey: args.sender,
        walletPublicKey: args.sender,
        signTransaction: args.signTransaction,
        signMessage: memoizedSignMessage,
        enforceViewingKeyRegistration: false,
        cachedMerkleTree: cachedTreeForDeposit,
        ...(addressLookupTableAccounts.length > 0 ? { addressLookupTableAccounts } : {}),
        onProgress: (status) => {
          if (!inSubmitPhase && isSubmittingStatus(status)) {
            inSubmitPhase = true;
            args.onProgress?.({ type: "deposit", phase: "submit", message: status });
            return;
          }
          args.onProgress?.({ type: "deposit", phase: inSubmitPhase ? "submit" : "proof", message: status });
        },
        onProofProgress: (percent) => {
          args.onProgress?.({
            type: "deposit",
            phase: "proof",
            proofPercent: normalizeProofPercent(percent),
            message: "Generating one private deposit for the batch",
          });
        },
      },
    );
  } catch (error) {
    const normalized = normalizeCloakError(error);
    const message = `${normalized.title}: ${normalized.message}`;
    await args.persistRunStatus({
      status: "failed",
      privateStatus: "deposit_failed",
      rows: args.rows.map((row) => ({
        id: row.id,
        rowStatus: "failed",
        privateStatus: "deposit_failed",
        errorMessage: message,
      })),
    });
    return {
      confirmed: 0,
      failed: args.rows.length,
      total: args.rows.length,
      depositSignature: null,
      runId: args.runId,
    };
  }

  saveMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId, depositResult.merkleTree);
  args.onProgress?.({ type: "deposit", phase: "confirmed", message: "Batch deposit confirmed", proofPercent: 100 });
  await args.persistRunStatus({
    status: "deposit_confirmed",
    privateDepositSignature: depositResult.signature,
    privateStatus: "deposit_confirmed",
    currentChangeUtxoCommitment: depositResult.outputCommitments[0]?.toString(16),
    rows: args.rows.map((row) => ({
      id: row.id,
      rowStatus: "queued",
      privateStatus: "queued",
      errorMessage: null,
    })),
  });

  let currentUtxo: Utxo = depositResult.outputUtxos[0];
  let cachedTree: MerkleTree | undefined = depositResult.merkleTree;
  let confirmed = 0;
  let failed = 0;

  for (const row of args.rows) {
    const position = row.position;
    args.onProgress?.({ type: "row", rowId: row.id, position, phase: "queued", message: `Queued row ${position}` });
    await args.persistRunStatus({
      status: "paying",
      privateStatus: "paying",
      rows: [{ id: row.id, rowStatus: "paying", privateStatus: "paying", errorMessage: null }],
    });

    await sleep(RELAY_SETTLE_DELAY_MS);
    const rowResult = await payRow({
      row,
      position,
      currentUtxo,
      cachedTree,
      attempt: 0,
    });

    if (rowResult.ok) {
      confirmed += 1;
      currentUtxo = rowResult.changeUtxo;
      cachedTree = rowResult.merkleTree ?? cachedTree;
      saveMerkleTreeCache(cloakConfig.cluster, cloakConfig.programId, cachedTree);

      const currentChangeUtxoCommitment = currentUtxo.commitment?.toString(16) ?? rowResult.outputCommitment?.toString(16) ?? null;
      args.onProgress?.({
        type: "row",
        rowId: row.id,
        position,
        phase: "confirmed",
        message: `Row ${position} paid`,
        proofPercent: 100,
        signature: rowResult.signature,
      });
      await args.persistRunStatus({
        status: confirmed === args.rows.length ? "completed" : "partially_paid",
        privateStatus: "paying",
        currentChangeUtxoCommitment,
        rows: [
          {
            id: row.id,
            rowStatus: "paid_private",
            privateStatus: "paid_private",
            privateWithdrawSignature: rowResult.signature,
            errorMessage: null,
          },
        ],
      });
    } else {
      failed += 1;
      args.onProgress?.({
        type: "row",
        rowId: row.id,
        position,
        phase: "failed",
        message: rowResult.error.message,
        errorMessage: rowResult.error.message,
      });
      await args.persistRunStatus({
        status: confirmed > 0 ? "partially_paid" : "recoverable",
        privateStatus: "recoverable",
        currentChangeUtxoCommitment: currentUtxo.commitment?.toString(16) ?? null,
        rows: [
          {
            id: row.id,
            rowStatus: "failed",
            privateStatus: "failed",
            errorMessage: rowResult.error.message,
          },
        ],
      });
    }
  }

  const finalStatus = failed === 0 ? "completed" : confirmed > 0 ? "partially_paid" : "recoverable";
  await args.persistRunStatus({
    status: finalStatus,
    privateDepositSignature: depositResult.signature,
    privateStatus: finalStatus,
    currentChangeUtxoCommitment: failed === 0 ? null : currentUtxo.commitment?.toString(16) ?? null,
    rows: [],
  });

  return {
    confirmed,
    failed,
    total: args.rows.length,
    depositSignature: depositResult.signature,
    runId: args.runId,
  };

  async function payRow(params: {
    row: BatchRowInput;
    position: number;
    currentUtxo: Utxo;
    cachedTree: MerkleTree | undefined;
    attempt: number;
  }): Promise<
    | { ok: true; changeUtxo: Utxo; merkleTree?: MerkleTree; signature: string; outputCommitment?: bigint }
    | { ok: false; error: Error }
  > {
    let inSubmitPhase = false;
    args.onProgress?.({
      type: "row",
      rowId: params.row.id,
      position: params.position,
      phase: "proof",
      proofPercent: 0,
      message:
        params.attempt === 0
          ? `Generating private transfer proof for row ${params.position}`
          : `Refreshing proof for row ${params.position}`,
    });

    try {
      const recipient = new PublicKey(params.row.recipient);
      const result = await partialWithdraw([params.currentUtxo], recipient, params.row.amountBaseUnits, {
        connection: args.connection,
        programId: cloakConfig.programId,
        relayUrl: cloakConfig.relayUrl,
        walletPublicKey: args.sender,
        signTransaction: args.signTransaction,
        signMessage: memoizedSignMessage,
        enforceViewingKeyRegistration: false,
        cachedMerkleTree: params.cachedTree,
        onProgress: (status) => {
          if (!inSubmitPhase && isSubmittingStatus(status)) {
            inSubmitPhase = true;
            args.onProgress?.({
              type: "row",
              rowId: params.row.id,
              position: params.position,
              phase: "submit",
              message: status,
            });
            return;
          }
          args.onProgress?.({
            type: "row",
            rowId: params.row.id,
            position: params.position,
            phase: inSubmitPhase ? "submit" : "proof",
            message: status,
          });
        },
        onProofProgress: (percent) => {
          args.onProgress?.({
            type: "row",
            rowId: params.row.id,
            position: params.position,
            phase: "proof",
            proofPercent: normalizeProofPercent(percent),
            message: `Generating private transfer proof for row ${params.position}`,
          });
        },
      });

      return {
        ok: true,
        changeUtxo: result.outputUtxos[0],
        merkleTree: result.merkleTree,
        signature: result.signature,
        outputCommitment: result.outputCommitments[0],
      };
    } catch (error) {
      if (params.attempt < STALE_RETRY_MAX && isRetryableWithdrawError(error, isRootNotFoundError)) {
        await sleep(STALE_RETRY_DELAY_MS);
        return payRow({ ...params, cachedTree: undefined, attempt: params.attempt + 1 });
      }
      const normalized = normalizeCloakError(error);
      return { ok: false, error: new Error(`${normalized.title}: ${normalized.message}`) };
    }
  }
}

function normalizeProofPercent(percent: number) {
  const normalized = percent <= 1 ? percent * 100 : percent;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
