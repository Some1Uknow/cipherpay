"use client";

import type { ChangeEvent } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { decimalAmountToBaseUnits } from "@/lib/cloak/amounts";
import type { BatchProgressEvent } from "@/lib/cloak/batch-payroll";
import type { FastSendPhase } from "@/lib/cloak/fast-send";
import { getPrivatePayoutAsset, isCloakPrivateRailEnabled } from "@/lib/cloak/config";
import { quoteCloakSolWithdrawal } from "@/lib/cloak/fees";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRowStatus, PayoutRunEntryMode, PayoutRunStatus } from "@/lib/payout-runs/types";
import { cn } from "@/lib/utils";
import {
  CSV_SAMPLE,
  createEmptyPayoutRow,
  isRowFilled,
  parseCsvRows,
  serializeDraft,
  validateRows,
} from "@/lib/payout-runs/validation";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type SubmitState = "idle" | "preparing" | "submitting" | "completed" | "failed";
type ReceiptStatus = "success" | "failed" | "recoverable";

type PaymentReceipt = {
  status: ReceiptStatus;
  runId: string | null;
  mode: PayoutRunEntryMode;
  recipientName: string;
  walletAddress: string;
  amount: string;
  assetSymbol: string;
  recipientCount?: number;
  confirmedCount?: number;
  failedCount?: number;
  depositSignature?: string | null;
  withdrawSignature?: string | null;
  errorMessage?: string | null;
  createdAt: string;
};

type BulkProgress = {
  total: number;
  confirmed: number;
  failed: number;
  activePosition: number | null;
};

const EXECUTION_PHASES: Array<{ id: FastSendPhase; label: string; description: string }> = [
  { id: "deposit-proof", label: "Deposit proof", description: "Generate the shielded deposit proof." },
  { id: "deposit-submit", label: "Fund private note", description: "Confirm the public funding transaction." },
  { id: "withdraw-proof", label: "Transfer proof", description: "Generate the recipient withdraw proof." },
  { id: "withdraw-submit", label: "Private send", description: "Submit the private transfer to Cloak." },
  { id: "success", label: "Receipt", description: "Record signatures and close the run." },
];
const CSV_ROW_LIMIT = 1000;
const CSV_UPLOAD_BYTES_LIMIT = 2_097_152;

function labelFastSendPhase(phase: FastSendPhase) {
  switch (phase) {
    case "deposit-proof":
      return "Preparing private deposit";
    case "deposit-submit":
      return "Confirming funding transaction";
    case "withdraw-proof":
      return "Preparing private transfer";
    case "withdraw-submit":
      return "Sending privately";
    case "success":
      return "Paid privately";
  }
}

function shortSignature(value?: string | null, edge = 8) {
  if (!value) return "Not recorded";
  if (value.length <= edge * 2 + 3) return value;
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function receiptTitle(status: ReceiptStatus) {
  if (status === "success") return "Payment sent";
  if (status === "recoverable") return "Payment needs recovery";
  return "Payment failed";
}

function normalizeProgressPercent(percent: number) {
  const normalized = percent <= 1 ? percent * 100 : percent;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function downloadReceiptPng(receipt: PaymentReceipt) {
  const canvas = document.createElement("canvas");
  const scale = window.devicePixelRatio || 1;
  canvas.width = 900 * scale;
  canvas.height = 620 * scale;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.scale(scale, scale);
  context.fillStyle = "#f7fbff";
  context.fillRect(0, 0, 900, 620);
  context.fillStyle = "#ffffff";
  roundRect(context, 42, 42, 816, 536, 28);
  context.fill();
  context.strokeStyle = "#dbe7f3";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = receipt.status === "success" ? "#0f9f6e" : receipt.status === "recoverable" ? "#b7791f" : "#b91c1c";
  roundRect(context, 78, 78, 176, 38, 19);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "600 15px sans-serif";
  context.fillText(receiptTitle(receipt.status), 100, 102);

  context.fillStyle = "#0f172a";
  context.font = "700 42px sans-serif";
  context.fillText(`${receipt.amount} ${receipt.assetSymbol}`, 78, 174);
  context.font = "500 18px sans-serif";
  context.fillStyle = "#64748b";
  context.fillText(`CipherPay ${receipt.mode === "manual" ? "manual pay" : "bulk pay"} receipt`, 78, 210);

  const rows = [
    ["Recipient", receipt.recipientName || "Recipient"],
    ["Wallet", receipt.walletAddress],
    ...(receipt.recipientCount ? [["Rows", `${receipt.confirmedCount ?? 0}/${receipt.recipientCount} paid${receipt.failedCount ? `, ${receipt.failedCount} failed` : ""}`]] : []),
    ["Deposit", shortSignature(receipt.depositSignature, 10)],
    ["Withdraw", shortSignature(receipt.withdrawSignature, 10)],
    ["Run", receipt.runId ?? "Not saved"],
    ["Time", new Date(receipt.createdAt).toLocaleString()],
  ];

  let y = 284;
  for (const [label, value] of rows) {
    context.fillStyle = "#64748b";
    context.font = "600 13px sans-serif";
    context.fillText(label.toUpperCase(), 78, y);
    context.fillStyle = "#0f172a";
    context.font = "600 18px sans-serif";
    wrapCanvasText(context, value, 78, y + 28, 720, 24);
    y += 70;
  }

  if (receipt.errorMessage) {
    context.fillStyle = "#b91c1c";
    context.font = "600 15px sans-serif";
    wrapCanvasText(context, receipt.errorMessage, 78, 548, 720, 22);
  }

  const link = document.createElement("a");
  link.download = `cipherpay-${receipt.mode}-${Date.now()}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, y);
}

function ExecutionStatusBox({
  activePhase,
  submitState,
  proofProgress,
  bulkProgress,
}: {
  activePhase: FastSendPhase | null;
  submitState: SubmitState;
  proofProgress: number | null;
  bulkProgress?: BulkProgress | null;
}) {
  const activeIndex = activePhase ? EXECUTION_PHASES.findIndex((phase) => phase.id === activePhase) : -1;
  const allComplete = submitState === "completed";
  const started = activeIndex >= 0 || submitState === "completed" || submitState === "failed";
  const visiblePhases = started
    ? EXECUTION_PHASES.filter((_, index) => index <= Math.max(activeIndex, allComplete ? EXECUTION_PHASES.length - 1 : 0))
    : [];

  return (
    <div className="rounded-[24px] border border-white/80 bg-white/72 p-3 shadow-neoInsetSm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-muted-ink)]">Execution</p>
        {bulkProgress ? (
          <p className="text-[11px] font-semibold text-[var(--brand-primary)]">
            {bulkProgress.confirmed}/{bulkProgress.total} paid
          </p>
        ) : proofProgress !== null && submitState !== "completed" ? (
          <p className="text-[11px] font-semibold text-[var(--brand-primary)]">Proof {proofProgress}%</p>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2">
        {visiblePhases.length > 0 ? (
          visiblePhases.map((phase, index) => {
            const complete = allComplete || (activeIndex > index && submitState !== "failed");
            const active = activeIndex === index && submitState !== "completed" && submitState !== "failed";
            const failed = activeIndex === index && submitState === "failed";

            return (
              <div
                key={phase.id}
                className={cn(
                  "flex translate-y-0 items-center gap-3 rounded-[18px] border px-3 py-2.5 opacity-100 transition-all duration-500",
                  complete
                    ? "border-emerald-200 bg-emerald-50/90"
                    : active
                      ? "border-[rgba(0,82,255,0.22)] bg-white shadow-neoSm"
                      : failed
                        ? "border-red-200 bg-red-50/90"
                        : "border-white/80 bg-white/60",
                )}
              >
                <div
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold transition-colors duration-300",
                    complete
                      ? "bg-emerald-600 text-white"
                      : active
                        ? "bg-[var(--brand-primary)] text-white"
                        : failed
                          ? "bg-red-600 text-white"
                          : "bg-slate-100 text-slate-500",
                  )}
                >
                  {complete ? "✓" : failed ? "!" : active ? <span className="size-3 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : index + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">{phase.label}</p>
                  <p className="truncate text-xs text-[var(--brand-muted-ink)]">
                    {active && bulkProgress?.activePosition
                      ? `Row ${bulkProgress.activePosition} of ${bulkProgress.total}`
                      : active && proofProgress !== null
                        ? `${phase.description} ${proofProgress}%`
                        : phase.description}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex items-center gap-3 rounded-[18px] border border-white/80 bg-white/60 px-3 py-2.5">
            <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">1</div>
            <div>
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Ready when you are</p>
              <p className="text-xs text-[var(--brand-muted-ink)]">Click send to start proof generation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentReceiptModal({
  receipt,
  onClose,
}: {
  receipt: PaymentReceipt;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.38)] px-4 py-6 backdrop-blur-[10px]" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" aria-label="Close receipt" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-[34px] border border-white/80 bg-[linear-gradient(180deg,#ffffff,#f4f9ff)] p-5 shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(0,82,255,0.14),transparent_72%)]" />
        <div className="relative">
          <Badge tone={receipt.status === "success" ? "green" : receipt.status === "recoverable" ? "amber" : "amber"}>
            {receiptTitle(receipt.status)}
          </Badge>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.055em] text-[var(--brand-ink-deep)]">
            {receipt.amount} {receipt.assetSymbol}
          </h2>
          <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
            {receipt.mode === "manual" ? "Manual pay" : "Bulk pay"} · {new Date(receipt.createdAt).toLocaleString()}
          </p>

          <div className="mt-5 grid gap-3 rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
            {[
              ["Recipient", receipt.recipientName || "Recipient"],
              ["Wallet", receipt.walletAddress],
              ...(receipt.recipientCount ? [["Rows", `${receipt.confirmedCount ?? 0}/${receipt.recipientCount} paid${receipt.failedCount ? ` · ${receipt.failedCount} failed` : ""}`]] : []),
              ["Deposit tx", shortSignature(receipt.depositSignature)],
              ["Private transfer", shortSignature(receipt.withdrawSignature)],
              ["Run", receipt.runId ?? "Not saved"],
            ].map(([label, value]) => (
              <div key={label} className="grid gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">{label}</p>
                <p className="break-all text-sm font-semibold text-[var(--brand-ink)]">{value}</p>
              </div>
            ))}
          </div>

          {receipt.errorMessage ? (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{receipt.errorMessage}</p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={() => downloadReceiptPng(receipt)}>Download PNG</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PayoutRunWorkspace({
  walletAddress,
  initialRun,
  entryMode,
}: {
  walletAddress: string;
  initialRun: PersistedPayoutRun | null;
  entryMode: PayoutRunEntryMode;
}) {
  const amountId = useId();
  const [runId, setRunId] = useState<string | null>(initialRun?.id ?? null);
  const mode = entryMode;
  const [rows, setRows] = useState<PayoutRowDraft[]>(() => {
    if (entryMode === "manual") {
      const firstRow = initialRun?.rows[0];
      return [
        firstRow ?? createEmptyPayoutRow(),
      ];
    }

    return initialRun?.rows ?? [];
  });
  const [csvDraft, setCsvDraft] = useState(CSV_SAMPLE);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSourceModalOpen, setCsvSourceModalOpen] = useState(false);
  const [csvSourceError, setCsvSourceError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitProgress, setSubmitProgress] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<FastSendPhase | null>(null);
  const [proofProgress, setProofProgress] = useState<number | null>(null);
  const [bulkProgress, setBulkProgress] = useState<BulkProgress | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null);
  const privateAsset = useMemo(() => getPrivatePayoutAsset(), []);
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const rowsToPersist = useMemo(() => (entryMode === "manual" ? rows.slice(0, 1) : rows), [entryMode, rows]);

  const initialSerialized = useMemo(
    () => serializeDraft(entryMode, entryMode === "manual" ? (initialRun?.rows.slice(0, 1) ?? [createEmptyPayoutRow()]) : (initialRun?.rows ?? [])),
    [entryMode, initialRun],
  );
  const lastSavedRef = useRef(initialSerialized);

  const issues = validateRows(rowsToPersist, {
    symbol: privateAsset.symbol,
    decimals: privateAsset.decimals,
  });
  const validCount = issues.filter((issue) => Object.keys(issue).length === 0).length;
  const invalidCount = issues.length - validCount;
  const filledRows = rowsToPersist.filter(isRowFilled);
  const total = rowsToPersist.reduce((sum, row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return sum;
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const isReady = filledRows.length > 0 && invalidCount === 0;
  const draftFingerprint = useMemo(() => serializeDraft(mode, rowsToPersist), [mode, rowsToPersist]);
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction, signMessage } = useWallet();
  const payoutConfigured = isCloakPrivateRailEnabled();

  function updateRow(id: string, field: keyof Omit<PayoutRowDraft, "id">, value: string) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              [field]: value,
              rowStatus: undefined,
              txSignature: null,
              errorMessage: null,
            }
          : row,
      ),
    );
    setSubmitState("idle");
    setSubmitError(null);
    setSubmitProgress(null);
    setActivePhase(null);
    setProofProgress(null);
    setBulkProgress(null);
  }

  function addRow() {
    setRows((current) => [...current, createEmptyPayoutRow()]);
    setSubmitState("idle");
    setSubmitError(null);
    setSubmitProgress(null);
    setActivePhase(null);
    setProofProgress(null);
    setBulkProgress(null);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    setSubmitState("idle");
    setSubmitError(null);
    setSubmitProgress(null);
    setActivePhase(null);
    setProofProgress(null);
    setBulkProgress(null);
  }

  function applyCsvDraft(nextDraft: string): string | null {
    try {
      const parsedRows = parseCsvRows(nextDraft);
      if (parsedRows.length > CSV_ROW_LIMIT) {
        const message = `Keep the roster to ${CSV_ROW_LIMIT.toLocaleString()} rows or fewer.`;
        setCsvError(message);
        return message;
      }
      setRows(parsedRows);
      setCsvDraft(nextDraft);
      setCsvError(null);
      setSubmitState("idle");
      setSubmitError(null);
      setSubmitProgress(null);
      setActivePhase(null);
      setProofProgress(null);
      setBulkProgress(null);
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV import failed.";
      setCsvError(message);
      return message;
    }
  }

  function loadCsvIntoTable() {
    applyCsvDraft(csvDraft);
  }

  async function handleCsvFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > CSV_UPLOAD_BYTES_LIMIT) {
      const message = `CSV uploads must be under ${(CSV_UPLOAD_BYTES_LIMIT / (1024 * 1024)).toFixed(1)} MB.`;
      setCsvError(message);
      setCsvSourceError(message);
      return;
    }

    try {
      const text = await file.text();
      if (!text.trim()) {
        const message = "The CSV file is empty.";
        setCsvError(message);
        setCsvSourceError(message);
        return;
      }
      const errorMessage = applyCsvDraft(text);
      if (errorMessage) {
        setCsvSourceError(errorMessage);
        return;
      }
      setCsvSourceError(null);
      setCsvSourceModalOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV import failed.";
      setCsvError(message);
      setCsvSourceError(message);
    }
  }

  function handleCsvTypeOut() {
    setCsvDraft(CSV_SAMPLE);
    setCsvError(null);
    setCsvSourceError(null);
    setCsvSourceModalOpen(false);
  }

  function resetRun() {
    const nextRows: PayoutRowDraft[] = entryMode === "manual" ? [createEmptyPayoutRow()] : [];
    setRunId(null);
    setRows(nextRows);
    setCsvDraft(CSV_SAMPLE);
    setCsvError(null);
    setCsvSourceError(null);
    setCsvSourceModalOpen(false);
    setSaveState("idle");
    setSaveError(null);
    setSubmitState("idle");
    setSubmitError(null);
    setSubmitProgress(null);
    setActivePhase(null);
    setProofProgress(null);
    setBulkProgress(null);
    setReceipt(null);
    lastSavedRef.current = serializeDraft(entryMode, nextRows);
  }

  async function persistRunStatus(params: {
    status: PayoutRunStatus;
    privateDepositSignature?: string | null;
    privateStatus?: string | null;
    currentChangeUtxoCommitment?: string | null;
    rows: Array<{
      id: string;
      rowStatus: PayoutRowStatus;
      txSignature?: string | null;
      privateWithdrawSignature?: string | null;
      grossBaseUnits?: string | null;
      feeBaseUnits?: string | null;
      netBaseUnits?: string | null;
      privateStatus?: string | null;
      errorMessage?: string | null;
    }>;
  }) {
    if (!runId) return;

    const response = await fetch(`/api/payout-runs/${runId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Could not persist payout status.");
    }
  }

  async function handleSubmitRun() {
    if (!runId) {
      setSubmitError("Save this draft before sending.");
      return;
    }

    if (!payoutConfigured) {
      setSubmitError("SOL payouts are not available in this build.");
      return;
    }

    if (privateAsset.symbol !== "SOL") {
      setSubmitError("Private payouts currently support SOL only.");
      return;
    }

    if (!connected || !publicKey) {
      setSubmitError("Connect the funding wallet before sending payouts.");
      return;
    }

    if (!signTransaction) {
      setSubmitError("This wallet does not support transaction signing.");
      return;
    }

    if (!signMessage) {
      setSubmitError("This wallet does not support message signing, which Cloak needs for relay authentication.");
      return;
    }

    if (entryMode === "csv") {
      const validRows = rowsToPersist
        .map((row, index) => ({ row, index, issues: issues[index] ?? {} }))
        .filter(({ row, issues }) => isRowFilled(row) && Object.keys(issues).length === 0);

      if (validRows.length === 0) {
        setSubmitError("Load at least one valid CSV row before running bulk pay.");
        return;
      }

      setSubmitState("preparing");
      setSubmitError(null);
      setSubmitProgress("Preparing batch deposit");
      setActivePhase("deposit-proof");
      setProofProgress(null);
      setBulkProgress({ total: validRows.length, confirmed: 0, failed: 0, activePosition: null });
      setReceipt(null);

      const quotedRows = validRows.map(({ row, index }) => {
        const amountBaseUnits = decimalAmountToBaseUnits(row.amount, privateAsset.decimals);
        const quote = quoteCloakSolWithdrawal(amountBaseUnits);
        return { row, index, amountBaseUnits, quote };
      });

      const queuedIds = new Set(quotedRows.map(({ row }) => row.id));
      setRows((current) =>
        current.map((currentRow) =>
          queuedIds.has(currentRow.id)
            ? { ...currentRow, rowStatus: "queued", privateStatus: "queued", errorMessage: null, txSignature: null }
            : currentRow,
        ),
      );

      await persistRunStatus({
        status: "depositing",
        privateStatus: "depositing",
        rows: quotedRows.map(({ row, amountBaseUnits, quote }) => ({
          id: row.id,
          rowStatus: "queued",
          grossBaseUnits: amountBaseUnits.toString(),
          feeBaseUnits: quote.totalFeeLamports.toString(),
          netBaseUnits: quote.netLamports.toString(),
          privateStatus: "queued",
          errorMessage: null,
        })),
      });

      let depositSignature: string | null = null;
      let confirmedCount = 0;
      let failedCount = 0;

      const applyBatchProgress = (event: BatchProgressEvent) => {
        if (event.type === "deposit") {
          setActivePhase(event.phase === "submit" || event.phase === "confirmed" ? "deposit-submit" : "deposit-proof");
          if (event.proofPercent !== undefined) setProofProgress(event.proofPercent);
          setSubmitProgress(event.message ?? (event.phase === "confirmed" ? "Batch deposit confirmed" : "Preparing batch deposit"));
          return;
        }

        if (event.phase === "proof") {
          setActivePhase("withdraw-proof");
          setSubmitState("preparing");
        } else if (event.phase === "submit") {
          setActivePhase("withdraw-submit");
          setSubmitState("submitting");
        }
        if (event.proofPercent !== undefined) setProofProgress(event.proofPercent);
        if (event.phase === "confirmed") confirmedCount += 1;
        if (event.phase === "failed") failedCount += 1;
        setBulkProgress({
          total: validRows.length,
          confirmed: confirmedCount,
          failed: failedCount,
          activePosition: event.phase === "confirmed" || event.phase === "failed" ? null : event.position,
        });
        setSubmitProgress(event.message ?? `Processing row ${event.position} of ${validRows.length}`);

        setRows((current) =>
          current.map((currentRow) => {
            if (currentRow.id !== event.rowId) return currentRow;
            if (event.phase === "confirmed") {
              return {
                ...currentRow,
                rowStatus: "paid_private",
                privateStatus: "paid_private",
                privateWithdrawSignature: event.signature ?? currentRow.privateWithdrawSignature,
                txSignature: event.signature ?? currentRow.txSignature,
                errorMessage: null,
              };
            }
            if (event.phase === "failed") {
              return {
                ...currentRow,
                rowStatus: "failed",
                privateStatus: "failed",
                errorMessage: event.errorMessage ?? event.message ?? "Private transfer failed.",
              };
            }
            return { ...currentRow, rowStatus: "paying", privateStatus: event.phase, errorMessage: null };
          }),
        );
      };

      try {
        const { runCloakBatchPayroll } = await import("@/lib/cloak/batch-payroll");
        const result = await runCloakBatchPayroll({
          runId,
          mint: new PublicKey(privateAsset.mint),
          sender: publicKey,
          connection,
          signTransaction,
          signMessage,
          rows: quotedRows.map(({ row, index, amountBaseUnits, quote }) => ({
            id: row.id,
            position: index + 1,
            recipient: row.walletAddress.trim(),
            amountBaseUnits,
            feeBaseUnits: quote.totalFeeLamports,
            netBaseUnits: quote.netLamports,
          })),
          persistRunStatus: async (event) => {
            if (event.privateDepositSignature) depositSignature = event.privateDepositSignature;
            await persistRunStatus({
              status: event.status ?? "paying",
              privateDepositSignature: event.privateDepositSignature,
              privateStatus: event.privateStatus,
              currentChangeUtxoCommitment: event.currentChangeUtxoCommitment,
              rows: event.rows ?? [],
            });
          },
          onProgress: applyBatchProgress,
        });

        const success = result.failed === 0;
        setSubmitState(success ? "completed" : "failed");
        setActivePhase(success ? "success" : activePhase);
        setProofProgress(success ? 100 : null);
        setSubmitProgress(success ? "Bulk payment complete" : `${result.confirmed}/${result.total} recipients paid. ${result.failed} failed.`);
        setBulkProgress({ total: result.total, confirmed: result.confirmed, failed: result.failed, activePosition: null });
        setRunId(null);
        setReceipt({
          status: success ? "success" : "recoverable",
          runId,
          mode: entryMode,
          recipientName: `${result.total} recipients`,
          walletAddress: "CSV batch",
          amount: total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: privateAsset.decimals }),
          assetSymbol: privateAsset.symbol,
          recipientCount: result.total,
          confirmedCount: result.confirmed,
          failedCount: result.failed,
          depositSignature: result.depositSignature,
          errorMessage: success ? null : `${result.failed} rows need review or recovery.`,
          createdAt: new Date().toISOString(),
        });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Bulk private payment failed.";
        setSubmitState("failed");
        setSubmitError(message);
        setSubmitProgress(null);
        setProofProgress(null);
        setBulkProgress((current) => current ? { ...current, activePosition: null } : null);
        setReceipt({
          status: depositSignature ? "recoverable" : "failed",
          runId,
          mode: entryMode,
          recipientName: `${validRows.length} recipients`,
          walletAddress: "CSV batch",
          amount: total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: privateAsset.decimals }),
          assetSymbol: privateAsset.symbol,
          recipientCount: validRows.length,
          confirmedCount,
          failedCount: validRows.length - confirmedCount,
          depositSignature,
          errorMessage: message,
          createdAt: new Date().toISOString(),
        });
        return;
      }
    }

    const row = rowsToPersist[0];
    if (!row) return;

    setSubmitState("preparing");
    setSubmitError(null);
    setSubmitProgress("Preparing private payment");
    setActivePhase("deposit-proof");
    setProofProgress(null);
    setBulkProgress(null);
    setReceipt(null);

    let depositSignature: string | null = null;

    try {
      const recipient = new PublicKey(row.walletAddress.trim());
      const amountBaseUnits = decimalAmountToBaseUnits(row.amount, privateAsset.decimals);
      const startedRows = rowsToPersist.map((currentRow) =>
        currentRow.id === row.id
          ? { ...currentRow, rowStatus: "paying" as const, errorMessage: null }
          : currentRow,
      );
      setRows(startedRows);

      await persistRunStatus({
        status: "depositing",
        privateStatus: "depositing",
        rows: [{ id: row.id, rowStatus: "paying", privateStatus: "depositing", errorMessage: null }],
      });

      const { fastSendPrivateSol } = await import("@/lib/cloak/fast-send");
      const result = await fastSendPrivateSol({
        amountBaseUnits,
        recipient,
        sender: publicKey,
        connection,
        signTransaction,
        signMessage,
        onPhase: (phase) => {
          setActivePhase(phase);
          setSubmitState(phase === "success" ? "completed" : phase.includes("submit") ? "submitting" : "preparing");
          setSubmitProgress(labelFastSendPhase(phase));
        },
        onProgress: setSubmitProgress,
        onProofProgress: (percent) => {
          setProofProgress(normalizeProgressPercent(percent));
        },
        onDepositConfirmed: async ({ signature }) => {
          depositSignature = signature;
          await persistRunStatus({
            status: "deposit_confirmed",
            privateDepositSignature: signature,
            privateStatus: "deposit_confirmed",
            rows: [{ id: row.id, rowStatus: "paying", privateStatus: "deposit_confirmed", errorMessage: null }],
          });
        },
      });

      const paidRow: PayoutRowDraft = {
        ...row,
        amountBaseUnits: amountBaseUnits.toString(),
        rowStatus: "paid_private",
        txSignature: result.withdrawSignature,
        privateWithdrawSignature: result.withdrawSignature,
        privateStatus: "paid_private",
        errorMessage: null,
      };
      lastSavedRef.current = serializeDraft(entryMode, [paidRow]);
      setRows([paidRow]);
      setSubmitState("completed");
      setActivePhase("success");
      setProofProgress(100);
      setSubmitProgress("Private payment completed");

      await persistRunStatus({
        status: "completed",
        privateDepositSignature: result.depositSignature,
        privateStatus: "completed",
        rows: [
          {
            id: row.id,
            rowStatus: "paid_private",
            txSignature: result.withdrawSignature,
            privateWithdrawSignature: result.withdrawSignature,
            privateStatus: "paid_private",
            errorMessage: null,
          },
        ],
      });
      setRunId(null);
      setReceipt({
        status: "success",
        runId,
        mode: entryMode,
        recipientName: row.recipientName,
        walletAddress: row.walletAddress,
        amount: row.amount,
        assetSymbol: privateAsset.symbol,
        depositSignature: result.depositSignature,
        withdrawSignature: result.withdrawSignature,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Private payment failed.";
      const isRecoverable = Boolean(depositSignature);
      const nextRunStatus: PayoutRunStatus = isRecoverable ? "recoverable" : "failed";
      const nextPrivateStatus = isRecoverable ? "recoverable" : "failed";
      const nextMessage = isRecoverable
        ? `${message} The deposit transaction already confirmed, so this run needs recovery instead of a fresh resend.`
        : message;
      setSubmitState("failed");
      setSubmitError(nextMessage);
      setSubmitProgress(null);
      setProofProgress(null);
      setRows((current) =>
        current.map((currentRow) =>
          currentRow.id === row.id
            ? { ...currentRow, rowStatus: "failed", privateStatus: nextPrivateStatus, errorMessage: nextMessage }
            : currentRow,
        ),
      );
      await persistRunStatus({
        status: nextRunStatus,
        privateDepositSignature: depositSignature,
        privateStatus: nextPrivateStatus,
        rows: [{ id: row.id, rowStatus: "failed", privateStatus: nextPrivateStatus, errorMessage: nextMessage }],
      }).catch(() => undefined);
      setReceipt({
        status: isRecoverable ? "recoverable" : "failed",
        runId,
        mode: entryMode,
        recipientName: row.recipientName,
        walletAddress: row.walletAddress,
        amount: row.amount,
        assetSymbol: privateAsset.symbol,
        depositSignature,
        errorMessage: nextMessage,
        createdAt: new Date().toISOString(),
      });
    }
  }

  useEffect(() => {
    if (draftFingerprint === lastSavedRef.current) return;

    setSaveState("dirty");
    setSaveError(null);

    const hasMeaningfulInput = rowsToPersist.some(isRowFilled) || Boolean(runId);
    if (!hasMeaningfulInput) return;

    const timeoutId = window.setTimeout(async () => {
      setSaveState("saving");

      try {
        const response = await fetch("/api/payout-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId,
            entryMode: mode,
            rows: rowsToPersist,
          }),
        });

        const payload = (await response.json()) as { run?: PersistedPayoutRun; error?: string };
        if (!response.ok || !payload.run) {
          throw new Error(payload.error ?? "Could not save this payout run.");
        }

        setRunId(payload.run.id);
        const nextRows = entryMode === "manual" ? [payload.run.rows[0] ?? createEmptyPayoutRow()] : payload.run.rows;
        setRows(nextRows);
        lastSavedRef.current = serializeDraft(payload.run.entryMode, nextRows);
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Could not save this payout run.");
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [draftFingerprint, entryMode, mode, rowsToPersist, runId]);

  const manualRow = rows[0] ?? createEmptyPayoutRow();
  const manualIssues = issues[0] ?? {};
  const singleRecipientName = manualRow.recipientName.trim() || "Recipient not added";
  const singleAmount = manualRow.amount.trim() || "0";
  const isManual = entryMode === "manual";
  const summaryCopy = (
    <div>
      <p className="text-sm font-semibold text-[var(--brand-ink)]">
        {isReady
          ? `${isManual ? "1 recipient" : `${validCount} recipients`} · ${total.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: privateAsset.decimals,
            })} ${privateAsset.symbol}`
          : filledRows.length === 0
            ? "Add payment details to continue."
            : "Fix the highlighted fields to continue."}
      </p>
      <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">
        {submitProgress
          ? submitProgress
          : saveState === "saving"
            ? "Saving draft..."
            : saveState === "error"
              ? "Draft save failed."
              : "Draft autosaves. The send button starts Cloak proof generation."}
      </p>
      {saveError ? <p className="mt-1 text-xs text-red-700">{saveError}</p> : null}
      {submitError ? <p className="mt-1 text-xs text-red-700">{submitError}</p> : null}
    </div>
  );

  return (
    <>
      {entryMode === "csv" && csvSourceModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.38)] px-4 py-6 backdrop-blur-[10px]" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0" aria-label="Close CSV options" onClick={() => setCsvSourceModalOpen(false)} />
          <div className="relative w-full max-w-lg overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,#ffffff,#f4f9ff)] p-5 shadow-[0_28px_90px_rgba(15,23,42,0.22)] sm:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(0,82,255,0.14),transparent_72%)]" />
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--brand-muted-ink)]">CSV roster</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--brand-ink)]">
                How would you like to add recipients?
              </h2>
              <p className="mt-2 text-sm text-[var(--brand-muted-ink)]">
                Choose between typing a roster or uploading a CSV file.
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  className="rounded-[22px] border border-white/80 bg-[var(--brand-surface)] p-4 text-left shadow-neoSm transition hover:-translate-y-0.5 hover:shadow-neo-hover"
                  onClick={handleCsvTypeOut}
                >
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">Type it out</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">
                    Paste or edit a roster in the editor. Up to {CSV_ROW_LIMIT.toLocaleString()} rows.
                  </p>
                </button>

                <div className="rounded-[22px] border border-white/80 bg-[var(--brand-surface)] p-4 shadow-neoSm">
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">Upload a CSV</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">
                    CSV up to {(CSV_UPLOAD_BYTES_LIMIT / (1024 * 1024)).toFixed(1)} MB with columns recipient_name, wallet_address,
                    amount.
                  </p>
                  <div className="mt-3">
                    <input
                      ref={csvFileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={handleCsvFileUpload}
                    />
                    <Button size="sm" onClick={() => csvFileInputRef.current?.click()}>
                      Choose file
                    </Button>
                  </div>
                </div>
              </div>

              {csvSourceError ? <p className="mt-4 text-sm text-red-700">{csvSourceError}</p> : null}

              <div className="mt-5 flex justify-end">
                <Button variant="secondary" onClick={() => setCsvSourceModalOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <div className="grid gap-5">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">
                  {entryMode === "manual" ? "Single pay" : "Bulk pay"}
                </p>
                <CardTitle className="mt-2 text-[28px] tracking-[-0.045em] text-[var(--brand-ink-deep)]">
                  {entryMode === "manual" ? "Send one payout quickly" : "Review one batch before sending"}
                </CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  {entryMode === "manual"
                    ? "Use a simple recipient form, confirm the amount, and send one private payout."
                    : "Paste or refine a CSV batch, resolve any row issues, and send the run once it is clean."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Private {privateAsset.symbol}</Badge>
                <Badge tone="slate">Rail: Cloak</Badge>
                <Badge tone="slate">Funding wallet: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</Badge>
                {runId ? <Badge tone="slate">Draft saved</Badge> : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {mode === "csv" ? (
              <div className="mt-6 grid gap-4 rounded-[30px] border border-white/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(238,247,255,0.7))] p-5 shadow-neoInsetSm">
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    ["1", "Paste roster", "Drop in recipient_name, wallet_address, amount."],
                    ["2", "Fix only what matters", `${validCount} valid · ${invalidCount} needs attention.`],
                    ["3", "Run privately", "One batch deposit, then private row payouts."],
                  ].map(([step, title, body]) => (
                    <div key={step} className="rounded-[24px] bg-[var(--brand-surface)] p-4 shadow-neoSm">
                      <div className="grid size-8 place-items-center rounded-full bg-[var(--brand-primary)] text-xs font-bold text-white">{step}</div>
                      <p className="mt-3 text-sm font-semibold text-[var(--brand-ink)]">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-[var(--brand-muted-ink)]">{body}</p>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">CSV roster</p>
                    <p className="text-sm text-[var(--brand-muted-ink)]">
                      Required columns: recipient_name, wallet_address, amount · Max {CSV_ROW_LIMIT.toLocaleString()} rows
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setCsvSourceModalOpen(true);
                        setCsvSourceError(null);
                      }}
                    >
                      Load sample
                    </Button>
                    <Button size="sm" onClick={loadCsvIntoTable}>
                      Validate roster
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={csvDraft}
                  onChange={(event) => setCsvDraft(event.target.value)}
                  className="min-h-40 font-mono-ui text-xs leading-6"
                />
                {csvError ? <p className="text-sm text-red-700">{csvError}</p> : null}
              </div>
            ) : null}

            {mode === "manual" ? (
              <div className="mt-6 grid gap-4">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                  <div className="rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetSm">
                    <div className="grid gap-2">
                      <p className="text-sm font-medium text-[var(--brand-ink)]">Recipient details</p>
                      <p className="text-sm text-[var(--brand-muted-ink)]">
                        Enter one recipient and one amount. CipherPay saves the draft as you type.
                      </p>
                    </div>

                    <div className="mt-6 grid gap-5">
                      <div className="space-y-2">
                        <Label htmlFor={`recipient-${manualRow.id}`}>Recipient name</Label>
                        <Input
                          id={`recipient-${manualRow.id}`}
                          value={manualRow.recipientName}
                          placeholder="Ava Patel"
                          autoComplete="name"
                          spellCheck={false}
                          aria-invalid={manualIssues.recipientName ? "true" : undefined}
                          aria-describedby={manualIssues.recipientName ? `recipient-${manualRow.id}-error` : undefined}
                          onChange={(event) => updateRow(manualRow.id, "recipientName", event.target.value)}
                        />
                        {manualIssues.recipientName ? (
                          <p id={`recipient-${manualRow.id}-error`} className="text-xs text-red-700">
                            {manualIssues.recipientName}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`wallet-${manualRow.id}`}>Wallet address</Label>
                        <Input
                          id={`wallet-${manualRow.id}`}
                          value={manualRow.walletAddress}
                          placeholder="Recipient Solana wallet"
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={manualIssues.walletAddress ? "true" : undefined}
                          aria-describedby={manualIssues.walletAddress ? `wallet-${manualRow.id}-error` : undefined}
                          onChange={(event) => updateRow(manualRow.id, "walletAddress", event.target.value)}
                        />
                        {manualIssues.walletAddress ? (
                          <p id={`wallet-${manualRow.id}-error`} className="text-xs text-red-700">
                            {manualIssues.walletAddress}
                          </p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`amount-${manualRow.id}`}>Amount ({privateAsset.symbol})</Label>
                        <Input
                          id={`amount-${manualRow.id}`}
                          type="text"
                          inputMode="decimal"
                          value={manualRow.amount}
                          placeholder="0.10"
                          autoComplete="off"
                          spellCheck={false}
                          aria-invalid={manualIssues.amount ? "true" : undefined}
                          aria-describedby={manualIssues.amount ? `amount-${manualRow.id}-error` : undefined}
                          onChange={(event) => updateRow(manualRow.id, "amount", event.target.value)}
                        />
                        {manualIssues.amount ? (
                          <p id={`amount-${manualRow.id}-error`} className="text-xs text-red-700">
                            {manualIssues.amount}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetSm">
                    <p className="text-sm font-medium text-[var(--brand-ink)]">Payment preview</p>
                    <div className="mt-5 grid gap-4">
                      <div className="rounded-[22px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoSm">
                        <p className="text-xs text-[var(--brand-muted-ink)]">Recipient</p>
                        <p className="mt-1 text-sm font-semibold text-[var(--brand-ink-deep)]">{singleRecipientName}</p>
                      </div>
                      <div className="rounded-[22px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoSm">
                        <p className="text-xs text-[var(--brand-muted-ink)]">Amount</p>
                        <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">
                          {singleAmount} {privateAsset.symbol}
                        </p>
                      </div>
                      <div className="rounded-[22px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoSm">
                        <p className="text-xs text-[var(--brand-muted-ink)]">Status</p>
                        <div className="mt-2">
                          {Object.keys(manualIssues).length > 0 ? (
                            <Badge tone="amber">Needs attention</Badge>
                          ) : filledRows.length === 0 ? (
                            <Badge tone="slate">Waiting for details</Badge>
                          ) : manualRow.rowStatus === "paid_private" ? (
                            <Badge tone="green">Paid privately</Badge>
                          ) : manualRow.rowStatus === "failed" ? (
                            <Badge tone="amber">Failed</Badge>
                          ) : (
                            <Badge tone="green">Ready</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ExecutionStatusBox
                        activePhase={activePhase}
                        submitState={submitState}
                        proofProgress={proofProgress}
                        bulkProgress={bulkProgress}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 overflow-hidden rounded-[28px] bg-[var(--brand-surface)] shadow-neoInsetSm">
                  {rows.length === 0 ? (
                    <div className="grid place-items-center px-6 py-14 text-center">
                      <div className="max-w-sm">
                        <p className="text-base font-medium text-[var(--brand-ink-deep)]">No batch rows yet</p>
                        <p className="mt-2 text-sm text-[var(--brand-muted-ink)]">
                          Paste a CSV above or add rows manually to build a payout batch.
                        </p>
                        <div className="mt-5 flex justify-center">
                          <Button variant="secondary" onClick={addRow}>
                            Add first row
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="hidden grid-cols-[1.1fr_1.4fr_0.7fr_140px] gap-3 border-b border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted-ink)] md:grid">
                        <span>Recipient</span>
                        <span>Wallet</span>
                        <span id={amountId}>Amount</span>
                        <span>Status</span>
                      </div>

                      <div className="grid gap-0 divide-y divide-[rgba(148,163,184,0.12)]">
                        {rows.map((row, index) => {
                          const rowIssues = issues[index] ?? {};
                          const rowHasIssues = Object.keys(rowIssues).length > 0;
                          return (
                            <div
                              key={row.id}
                              className="grid gap-3 bg-[var(--brand-surface)] px-5 py-4 md:grid-cols-[1.1fr_1.4fr_0.7fr_140px]"
                            >
                              <div className="space-y-2">
                                <Label htmlFor={`recipient-${row.id}`} className="md:sr-only">
                                  Recipient name
                                </Label>
                                <Input
                                  id={`recipient-${row.id}`}
                                  value={row.recipientName}
                                  placeholder="Recipient name"
                                  onChange={(event) => updateRow(row.id, "recipientName", event.target.value)}
                                />
                                {rowIssues.recipientName ? <p className="text-xs text-red-700">{rowIssues.recipientName}</p> : null}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`wallet-${row.id}`} className="md:sr-only">
                                  Wallet address
                                </Label>
                                <Input
                                  id={`wallet-${row.id}`}
                                  value={row.walletAddress}
                                  placeholder="Wallet address"
                                  onChange={(event) => updateRow(row.id, "walletAddress", event.target.value)}
                                />
                                {rowIssues.walletAddress ? <p className="text-xs text-red-700">{rowIssues.walletAddress}</p> : null}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`amount-${row.id}`} className="md:sr-only">
                                  Amount
                                </Label>
                                <Input
                                  id={`amount-${row.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={row.amount}
                                  placeholder="0.00"
                                  aria-labelledby={amountId}
                                  onChange={(event) => updateRow(row.id, "amount", event.target.value)}
                                />
                                {rowIssues.amount ? <p className="text-xs text-red-700">{rowIssues.amount}</p> : null}
                              </div>

                              <div className="flex items-start justify-between gap-3 md:flex-col md:justify-center">
                                <div className="pt-2">
                                  {rowHasIssues ? (
                                    <Badge tone="amber">Needs attention</Badge>
                                  ) : row.rowStatus === "paid_private" ? (
                                    <Badge tone="green">Paid privately</Badge>
                                  ) : row.rowStatus === "paying" || row.rowStatus === "queued" ? (
                                    <Badge tone="blue">Queued</Badge>
                                  ) : row.rowStatus === "failed" ? (
                                    <Badge tone="amber">Failed</Badge>
                                  ) : row.recipientName || row.walletAddress || row.amount ? (
                                    <Badge tone="green">Ready</Badge>
                                  ) : (
                                    <Badge tone="slate">Empty</Badge>
                                  )}
                                  {row.txSignature ? (
                                    <p className="mt-2 max-w-[170px] truncate text-xs text-[var(--brand-muted-ink)]">
                                      {row.txSignature}
                                    </p>
                                  ) : null}
                                  {row.errorMessage ? <p className="mt-2 max-w-[170px] text-xs text-red-700">{row.errorMessage}</p> : null}
                                  {rowIssues.row ? <p className="mt-2 max-w-[150px] text-xs text-red-700">{rowIssues.row}</p> : null}
                                </div>
                                <button
                                  type="button"
                                  className="text-sm font-medium text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)]"
                                  onClick={() => removeRow(row.id)}
                                  aria-label="Remove row"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                  <Button variant="secondary" onClick={resetRun}>
                    Start fresh
                  </Button>
                  {rows.length > 0 ? (
                    <Button variant="secondary" onClick={addRow}>
                      Add recipient
                    </Button>
                  ) : null}
                </div>
              </>
            )}
            <div className="mt-6 rounded-[28px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.86),rgba(244,249,255,0.78))] p-4 shadow-neoSm">
              {entryMode === "csv" ? (
                <>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
                    {summaryCopy}
                    <ExecutionStatusBox
                      activePhase={activePhase}
                      submitState={submitState}
                      proofProgress={proofProgress}
                      bulkProgress={bulkProgress}
                    />
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={resetRun}>
                      {isManual ? "Clear" : "Start fresh"}
                    </Button>
                    <Button
                      size="lg"
                      disabled={!isReady || !payoutConfigured || submitState === "preparing" || submitState === "submitting" || submitState === "completed"}
                      onClick={handleSubmitRun}
                    >
                      {!payoutConfigured
                        ? "Private payouts unavailable"
                        : submitState === "completed"
                          ? "Payment sent"
                        : submitState === "preparing"
                          ? "Generating proof..."
                          : submitState === "submitting"
                            ? "Sending..."
                            : rowsToPersist.some((row) => row.rowStatus === "failed")
                              ? "Retry payment"
                              : isManual
                                ? "Send payment"
                                : "Send private payouts"}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  {summaryCopy}
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="secondary" onClick={resetRun}>
                      {isManual ? "Clear" : "Start fresh"}
                    </Button>
                    <Button
                      size="lg"
                      disabled={!isReady || !payoutConfigured || submitState === "preparing" || submitState === "submitting" || submitState === "completed"}
                      onClick={handleSubmitRun}
                    >
                      {!payoutConfigured
                        ? "Private payouts unavailable"
                        : submitState === "completed"
                          ? "Payment sent"
                        : submitState === "preparing"
                          ? "Generating proof..."
                          : submitState === "submitting"
                            ? "Sending..."
                            : rowsToPersist.some((row) => row.rowStatus === "failed")
                              ? "Retry payment"
                              : isManual
                                ? "Send payment"
                                : "Send private payouts"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {receipt ? <PaymentReceiptModal receipt={receipt} onClose={() => setReceipt(null)} /> : null}
    </>
  );
}
