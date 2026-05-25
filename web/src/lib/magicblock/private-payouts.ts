import bs58 from "bs58";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";

import { decimalAmountToBaseUnits, sumBaseUnitAmounts } from "@/lib/magicblock/amounts";
import { getPrivatePayoutAsset } from "@/lib/magicblock/config";
import type { MagicBlockBuiltTransaction, MagicBlockSendTo } from "@/lib/magicblock/api";
import {
  buildWrapNativeSolTransaction,
  signSendAndConfirmBaseTransaction,
  signSendAndConfirmMagicBlockTransaction,
  type SignAndSendTransaction,
} from "@/lib/magicblock/transactions";
import type { PayoutRowDraft, PayoutRowStatus, PayoutRunStatus } from "@/lib/payout-runs/types";

type ProgressEvent =
  | { type: "health" }
  | { type: "mint" }
  | { type: "balance"; privateBalance: string; requiredTotal: string; shortfall: string }
  | { type: "wrap"; amount: string }
  | { type: "deposit"; signature: string; sendTo: MagicBlockSendTo; validator: string }
  | { type: "transfer"; rowId: string; signature: string; sendTo: MagicBlockSendTo }
  | { type: "row-failed"; rowId: string; error: string };

type PersistRunStatus = (params: {
  status: PayoutRunStatus;
  magicblockDepositSignature?: string | null;
  magicblockDepositSendTo?: MagicBlockSendTo | null;
  magicblockPrivateStatus?: string | null;
  privateBalanceBefore?: string | null;
  privateBalanceAfter?: string | null;
  rows: Array<{
    id: string;
    rowStatus: PayoutRowStatus;
    txSignature?: string | null;
    magicblockTransferSignature?: string | null;
    magicblockTransferSendTo?: MagicBlockSendTo | null;
    privateStatus?: string | null;
    errorMessage?: string | null;
  }>;
}) => Promise<void>;

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed: ${response.status}`);
  }
  return payload;
}

function rowBaseUnits(row: PayoutRowDraft, decimals: number) {
  return BigInt(row.amountBaseUnits ?? decimalAmountToBaseUnits(row.amount, decimals).toString());
}

function unpaidPrivateRows(rows: PayoutRowDraft[], decimals: number) {
  return rows.filter((row) => {
    if (!row.recipientName.trim() || !row.walletAddress.trim() || !row.amount.trim()) return false;
    if (row.rowStatus === "paid_private" || row.rowStatus === "confirmed") return false;
    return rowBaseUnits(row, decimals) > BigInt(0);
  });
}

async function authenticateMagicBlock(signMessage: SignMessage | undefined): Promise<string | null> {
  if (!signMessage) return null;

  const challenge = await fetchJson<{ challenge: string }>("/api/magicblock/challenge");
  const signature = await signMessage(new TextEncoder().encode(challenge.challenge));
  const login = await fetchJson<{ token: string }>("/api/magicblock/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challenge: challenge.challenge,
      signature: bs58.encode(signature),
    }),
  });

  return login.token;
}

async function readPrivateBalance(token: string | null): Promise<string | null> {
  if (!token) return null;
  const balance = await fetchJson<{ balance: string }>("/api/magicblock/private-balance", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return balance.balance;
}

async function readBaseTokenBalance(params: { connection: Connection; owner: PublicKey; mint: PublicKey }) {
  const ata = getAssociatedTokenAddressSync(params.mint, params.owner);
  try {
    const balance = await params.connection.getTokenAccountBalance(ata, "confirmed");
    return BigInt(balance.value.amount);
  } catch {
    return BigInt(0);
  }
}

export async function preparePrivatePayoutRun(params: {
  rows: PayoutRowDraft[];
  signMessage?: SignMessage;
  onProgress?: (event: ProgressEvent) => void;
}) {
  const asset = getPrivatePayoutAsset();
  const readyRows = unpaidPrivateRows(params.rows, asset.decimals);
  if (readyRows.length === 0) {
    throw new Error("There are no unpaid valid rows to send.");
  }

  params.onProgress?.({ type: "health" });
  const health = await fetchJson<{ status: string }>("/api/magicblock/health");
  if (health.status !== "ok") {
    throw new Error("MagicBlock private payments API is not healthy.");
  }

  params.onProgress?.({ type: "mint" });
  const mint = await fetchJson<{ initialized: boolean }>("/api/magicblock/is-mint-initialized");
  if (!mint.initialized) {
    throw new Error("The configured MagicBlock private payout mint is not initialized for this validator.");
  }

  const token = await authenticateMagicBlock(params.signMessage);
  const privateBalance = await readPrivateBalance(token);
  const requiredTotal = sumBaseUnitAmounts(readyRows.map((row) => rowBaseUnits(row, asset.decimals)));
  const availablePrivateBalance = privateBalance ? BigInt(privateBalance) : BigInt(0);
  const shortfall = availablePrivateBalance >= requiredTotal ? BigInt(0) : requiredTotal - availablePrivateBalance;

  params.onProgress?.({
    type: "balance",
    privateBalance: availablePrivateBalance.toString(),
    requiredTotal: requiredTotal.toString(),
    shortfall: shortfall.toString(),
  });

  return {
    asset,
    token,
    readyRows,
    privateBalanceBefore: privateBalance,
    requiredTotal,
    shortfall,
  };
}

export async function executePrivatePayoutRun(params: {
  runId: string;
  payer: PublicKey;
  rows: PayoutRowDraft[];
  baseConnection: Connection;
  ephemeralConnection: Connection;
  sendTransaction: SignAndSendTransaction;
  signMessage?: SignMessage;
  persistRunStatus: PersistRunStatus;
  onProgress?: (event: ProgressEvent) => void;
}) {
  const prepared = await preparePrivatePayoutRun({
    rows: params.rows,
    signMessage: params.signMessage,
    onProgress: params.onProgress,
  });

  const nextRows = [...params.rows];

  await params.persistRunStatus({
    status: prepared.shortfall > BigInt(0) ? "deposit_required" : "deposit_confirmed",
    magicblockPrivateStatus: prepared.shortfall > BigInt(0) ? "deposit_required" : "deposit_confirmed",
    privateBalanceBefore: prepared.privateBalanceBefore,
    rows: prepared.readyRows.map((row) => ({ id: row.id, rowStatus: "queued", privateStatus: "queued" })),
  });

  if (prepared.shortfall > BigInt(0)) {
    if (prepared.asset.fundingBehavior === "wrap_native_sol") {
      const currentWrappedBalance = await readBaseTokenBalance({
        connection: params.baseConnection,
        owner: params.payer,
        mint: NATIVE_MINT,
      });
      const amountToWrap = currentWrappedBalance >= prepared.shortfall ? BigInt(0) : prepared.shortfall - currentWrappedBalance;
      if (amountToWrap > BigInt(0)) {
        const wrapTransaction = buildWrapNativeSolTransaction({
          payer: params.payer,
          amountBaseUnits: amountToWrap,
          asset: prepared.asset,
        });
        if (wrapTransaction) {
          params.onProgress?.({ type: "wrap", amount: amountToWrap.toString() });
          await signSendAndConfirmBaseTransaction({
            transaction: wrapTransaction,
            payer: params.payer,
            connection: params.baseConnection,
            sendTransaction: params.sendTransaction,
          });
        }
      }
    }

    await params.persistRunStatus({
      status: "depositing",
      magicblockPrivateStatus: "depositing",
      rows: [],
    });

    const deposit = await fetchJson<MagicBlockBuiltTransaction>("/api/magicblock/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: params.runId,
        amount: prepared.shortfall.toString(),
      }),
    });
    const depositSignature = await signSendAndConfirmMagicBlockTransaction({
      built: deposit,
      sendTransaction: params.sendTransaction,
      connections: { base: params.baseConnection, ephemeral: params.ephemeralConnection },
    });

    params.onProgress?.({
      type: "deposit",
      signature: depositSignature,
      sendTo: deposit.sendTo,
      validator: deposit.validator,
    });

    await params.persistRunStatus({
      status: "deposit_confirmed",
      magicblockDepositSignature: depositSignature,
      magicblockDepositSendTo: deposit.sendTo,
      magicblockPrivateStatus: "deposit_confirmed",
      rows: [],
    });
  }

  let anyFailures = false;

  for (const row of prepared.readyRows) {
    await params.persistRunStatus({
      status: "transferring",
      magicblockPrivateStatus: "transferring",
      rows: [{ id: row.id, rowStatus: "queued", privateStatus: "queued" }],
    });

    try {
      const transfer = await fetchJson<MagicBlockBuiltTransaction>("/api/magicblock/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: params.runId,
          rowId: row.id,
          token: prepared.token,
        }),
      });
      const signature = await signSendAndConfirmMagicBlockTransaction({
        built: transfer,
        sendTransaction: params.sendTransaction,
        connections: { base: params.baseConnection, ephemeral: params.ephemeralConnection },
      });

      const rowIndex = nextRows.findIndex((candidate) => candidate.id === row.id);
      if (rowIndex >= 0) {
        nextRows[rowIndex] = {
          ...nextRows[rowIndex],
          rowStatus: "paid_private",
          txSignature: signature,
          magicblockTransferSignature: signature,
          magicblockTransferSendTo: transfer.sendTo,
          privateStatus: "paid_private",
          errorMessage: null,
        };
      }

      params.onProgress?.({ type: "transfer", rowId: row.id, signature, sendTo: transfer.sendTo });
      await params.persistRunStatus({
        status: "transferring",
        rows: [
          {
            id: row.id,
            rowStatus: "paid_private",
            txSignature: signature,
            magicblockTransferSignature: signature,
            magicblockTransferSendTo: transfer.sendTo,
            privateStatus: "paid_private",
          },
        ],
      });
    } catch (error) {
      anyFailures = true;
      const message = error instanceof Error ? error.message : "Private transfer failed.";
      const rowIndex = nextRows.findIndex((candidate) => candidate.id === row.id);
      if (rowIndex >= 0) {
        nextRows[rowIndex] = {
          ...nextRows[rowIndex],
          rowStatus: "failed",
          privateStatus: "failed",
          errorMessage: message,
        };
      }

      params.onProgress?.({ type: "row-failed", rowId: row.id, error: message });
      await params.persistRunStatus({
        status: "partially_paid",
        rows: [{ id: row.id, rowStatus: "failed", privateStatus: "failed", errorMessage: message }],
      });
    }
  }

  const privateBalanceAfter = await readPrivateBalance(prepared.token).catch(() => null);
  const completedStatus: PayoutRunStatus = anyFailures ? "partially_paid" : "completed";

  await params.persistRunStatus({
    status: completedStatus,
    magicblockPrivateStatus: completedStatus,
    privateBalanceAfter,
    rows: nextRows
      .filter((row) => row.rowStatus === "paid_private" || row.rowStatus === "failed")
      .map((row) => ({
        id: row.id,
        rowStatus: row.rowStatus as "paid_private" | "failed",
        txSignature: row.txSignature,
        magicblockTransferSignature: row.magicblockTransferSignature,
        magicblockTransferSendTo: row.magicblockTransferSendTo,
        privateStatus: row.privateStatus,
        errorMessage: row.errorMessage,
      })),
  });

  return {
    rows: nextRows,
    status: completedStatus,
    privateBalanceBefore: prepared.privateBalanceBefore,
    privateBalanceAfter,
  };
}
