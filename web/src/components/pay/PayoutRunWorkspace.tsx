"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBaseUnits } from "@/lib/magicblock/amounts";
import { getPrivatePayoutAsset, isMagicBlockPrivateRailEnabled } from "@/lib/magicblock/config";
import { executePrivatePayoutRun } from "@/lib/magicblock/private-payouts";
import { publicConfig } from "@/lib/public-config";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRowStatus, PayoutRunEntryMode, PayoutRunStatus } from "@/lib/payout-runs/types";
import {
  CSV_SAMPLE,
  createEmptyPayoutRow,
  isRowFilled,
  parseCsvRows,
  serializeDraft,
  validateRows,
} from "@/lib/payout-runs/validation";
import { cn } from "@/lib/utils";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type SubmitState = "idle" | "preparing" | "submitting" | "completed" | "failed";

export function PayoutRunWorkspace({
  walletAddress,
  initialRun,
}: {
  walletAddress: string;
  initialRun: PersistedPayoutRun | null;
}) {
  const amountId = useId();
  const [runId, setRunId] = useState<string | null>(initialRun?.id ?? null);
  const [mode, setMode] = useState<PayoutRunEntryMode>(initialRun?.entryMode ?? "manual");
  const [rows, setRows] = useState<PayoutRowDraft[]>(() => initialRun?.rows ?? []);
  const [csvDraft, setCsvDraft] = useState(CSV_SAMPLE);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [privateBalance, setPrivateBalance] = useState<string | null>(initialRun?.privateBalanceBefore ?? null);
  const [depositNeeded, setDepositNeeded] = useState<string | null>(null);
  const [paidPrivateCount, setPaidPrivateCount] = useState(() => initialRun?.rows.filter((row) => row.rowStatus === "paid_private").length ?? 0);
  const privateAsset = useMemo(() => getPrivatePayoutAsset(), []);

  const initialSerialized = useMemo(
    () => serializeDraft(initialRun?.entryMode ?? "manual", initialRun?.rows ?? []),
    [initialRun],
  );
  const lastSavedRef = useRef(initialSerialized);

  const issues = validateRows(rows, {
    symbol: privateAsset.symbol,
    decimals: privateAsset.decimals,
  });
  const validCount = issues.filter((issue) => Object.keys(issue).length === 0).length;
  const invalidCount = issues.length - validCount;
  const filledRows = rows.filter(isRowFilled);
  const total = rows.reduce((sum, row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return sum;
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const isReady = filledRows.length > 0 && invalidCount === 0;
  const draftFingerprint = useMemo(() => serializeDraft(mode, rows), [mode, rows]);
  const { connection } = useConnection();
  const ephemeralConnection = useMemo(
    () => new Connection(publicConfig.magicblockEphemeralRpcUrl, { commitment: "confirmed", wsEndpoint: publicConfig.magicblockEphemeralWsUrl }),
    [],
  );
  const { publicKey, sendTransaction, signMessage, connected } = useWallet();
  const payoutConfigured = isMagicBlockPrivateRailEnabled();

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
  }

  function addRow() {
    setRows((current) => [...current, createEmptyPayoutRow()]);
    setSubmitState("idle");
    setSubmitError(null);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    setSubmitState("idle");
    setSubmitError(null);
  }

  function loadCsvIntoTable() {
    try {
      const parsedRows = parseCsvRows(csvDraft);
      setRows(parsedRows);
      setCsvError(null);
      setSubmitState("idle");
      setSubmitError(null);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "CSV import failed.");
    }
  }

  function resetRun() {
    const nextRows: PayoutRowDraft[] = [];
    setRunId(null);
    setMode("manual");
    setRows(nextRows);
    setSaveState("idle");
    setSaveError(null);
    setSubmitState("idle");
    setSubmitError(null);
    setPrivateBalance(null);
    setDepositNeeded(null);
    setPaidPrivateCount(0);
    lastSavedRef.current = serializeDraft("manual", nextRows);
  }

  async function persistRunStatus(params: {
    status: PayoutRunStatus;
    magicblockDepositSignature?: string | null;
    magicblockDepositSendTo?: "base" | "ephemeral" | null;
    magicblockPrivateStatus?: string | null;
    privateBalanceBefore?: string | null;
    privateBalanceAfter?: string | null;
    rows: Array<{
      id: string;
      rowStatus: PayoutRowStatus;
      txSignature?: string | null;
      magicblockTransferSignature?: string | null;
      magicblockTransferSendTo?: "base" | "ephemeral" | null;
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

    if (!connected || !publicKey || !sendTransaction) {
      setSubmitError("Connect the funding wallet before sending payouts.");
      return;
    }
    const fundingWallet = publicKey;

    setSubmitState("preparing");
    setSubmitError(null);

    try {
      const result = await executePrivatePayoutRun({
        runId,
        payer: fundingWallet,
        rows,
        baseConnection: connection,
        ephemeralConnection,
        sendTransaction,
        signMessage: signMessage ?? undefined,
        persistRunStatus,
        onProgress: (event) => {
          if (event.type === "balance") {
            setPrivateBalance(event.privateBalance);
            setDepositNeeded(event.shortfall);
          }
          if (event.type === "deposit" || event.type === "transfer") {
            setSubmitState("submitting");
          }
          if (event.type === "transfer") {
            setPaidPrivateCount((current) => current + 1);
          }
        },
      });

      setRows(result.rows);
      setPrivateBalance(result.privateBalanceAfter ?? result.privateBalanceBefore);
      setSubmitState(result.status === "completed" ? "completed" : "failed");
    } catch (error) {
      setSubmitState("failed");
      setSubmitError(error instanceof Error ? error.message : "Payout run failed.");
    }
  }

  useEffect(() => {
    if (draftFingerprint === lastSavedRef.current) return;

    setSaveState("dirty");
    setSaveError(null);

    const hasMeaningfulInput = rows.length > 0 || Boolean(runId);
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
            rows,
          }),
        });

        const payload = (await response.json()) as { run?: PersistedPayoutRun; error?: string };
        if (!response.ok || !payload.run) {
          throw new Error(payload.error ?? "Could not save this payout run.");
        }

        setRunId(payload.run.id);
        const nextRows = payload.run.rows;
        setRows(nextRows);
        setMode(payload.run.entryMode);
        lastSavedRef.current = serializeDraft(payload.run.entryMode, nextRows);
        setSaveState("saved");
      } catch (error) {
        setSaveState("error");
        setSaveError(error instanceof Error ? error.message : "Could not save this payout run.");
      }
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [draftFingerprint, mode, rows, runId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Payout run</p>
                <CardTitle className="mt-2 text-[28px] tracking-[-0.045em] text-[var(--brand-ink-deep)]">Build one clean payout run</CardTitle>
                <CardDescription className="mt-2 max-w-2xl">Draft rows, review totals, send.</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">Private {privateAsset.symbol}</Badge>
                <Badge tone="slate">Rail: MagicBlock</Badge>
                <Badge tone="slate">Funding wallet: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</Badge>
                {runId ? <Badge tone="slate">Draft saved</Badge> : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[var(--brand-surface)] p-1.5 shadow-neoInsetSm">
              <button
                type="button"
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                  mode === "manual"
                    ? "bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoSm"
                    : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink-deep)]",
                )}
                onClick={() => setMode("manual")}
              >
                Manual
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                  mode === "csv"
                    ? "bg-[var(--brand-surface)] text-[var(--brand-primary)] shadow-neoSm"
                    : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink-deep)]",
                )}
                onClick={() => setMode("csv")}
              >
                CSV
              </button>
            </div>

            {mode === "csv" ? (
              <div className="mt-6 grid gap-4 rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetSm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--brand-ink)]">Paste CSV rows</p>
                    <p className="text-sm text-[var(--brand-muted-ink)]">Columns: recipient_name, wallet_address, amount</p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setCsvDraft(CSV_SAMPLE)}>
                    Load sample
                  </Button>
                </div>
                <Textarea
                  value={csvDraft}
                  onChange={(event) => setCsvDraft(event.target.value)}
                  className="min-h-36 font-mono-ui text-xs leading-6"
                />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-[var(--brand-muted-ink)]">Paste → validate → load.</p>
                  <Button onClick={loadCsvIntoTable}>Use these rows</Button>
                </div>
                {csvError ? <p className="text-sm text-red-700">{csvError}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-[28px] bg-[var(--brand-surface)] shadow-neoInsetSm">
              {rows.length === 0 ? (
                <div className="grid place-items-center px-6 py-14 text-center">
                  <div className="max-w-sm">
                    <p className="text-base font-medium text-[var(--brand-ink-deep)]">No recipients added yet</p>
                    <p className="mt-2 text-sm text-[var(--brand-muted-ink)]">Add the first row here, or load a CSV into the same payout run.</p>
                    <div className="mt-5 flex justify-center">
                      <Button variant="secondary" onClick={addRow}>
                        Add recipient
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
                              ) : row.rowStatus === "confirmed" ? (
                                <Badge tone="green">Confirmed</Badge>
                              ) : row.rowStatus === "submitted" || row.rowStatus === "queued" ? (
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
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm px-4 py-3">
                <p className="text-xs text-[var(--brand-muted-ink)]">Valid rows</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{validCount}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm px-4 py-3">
                <p className="text-xs text-[var(--brand-muted-ink)]">Needs attention</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{invalidCount}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm px-4 py-3 sm:col-span-2 xl:col-span-1">
                <p className="text-xs text-[var(--brand-muted-ink)]">Total amount</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">
                  {total.toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: privateAsset.decimals,
                  })}{" "}
                  {privateAsset.symbol}
                </p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm px-4 py-3 sm:col-span-2 xl:col-span-1">
                <p className="text-xs text-[var(--brand-muted-ink)]">Paid privately</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{paidPrivateCount}</p>
              </div>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Funding wallet</p>
              <p className="mt-2 break-all text-sm text-[var(--brand-ink-deep)]">{walletAddress}</p>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Run state</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {isReady
                  ? "Ready to send through the private payout rail."
                  : filledRows.length === 0
                    ? "Start by adding at least one payout row."
                    : "Fix the highlighted rows before sending."}
              </p>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Private balance</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {privateBalance
                  ? `${formatBaseUnits(privateBalance, privateAsset.decimals)} ${privateAsset.symbol}`
                  : "Checked when you send."}
              </p>
              {depositNeeded ? (
                <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">
                  Deposit needed: {formatBaseUnits(depositNeeded, privateAsset.decimals)} {privateAsset.symbol}
                </p>
              ) : null}
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Draft status</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {saveState === "saving"
                  ? "Saving your draft…"
                  : saveState === "saved"
                    ? "Draft saved automatically."
                    : saveState === "error"
                      ? "Draft save failed."
                      : saveState === "dirty"
                        ? "Unsaved changes detected."
                        : "Draft has not been saved yet."}
              </p>
              {saveError ? <p className="mt-2 text-xs text-red-700">{saveError}</p> : null}
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Execution</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {!payoutConfigured
                  ? "Private payouts are disabled in this build."
                  : submitState === "preparing"
                    ? "Checking MagicBlock, private balance, and deposit requirements…"
                    : submitState === "submitting"
                      ? "Depositing wSOL if needed, then sending private transfers…"
                      : submitState === "completed"
                        ? "All ready rows were paid privately."
                        : submitState === "failed"
                          ? "Some payouts failed. Review row-level status below."
                      : "CipherPay uses wSOL privately under the hood. Recipients receive SOL-equivalent value in their private balance."}
              </p>
              {submitError ? <p className="mt-2 text-xs text-red-700">{submitError}</p> : null}
            </div>

            <Button
              size="lg"
              disabled={!isReady || !payoutConfigured || submitState === "preparing" || submitState === "submitting"}
              onClick={handleSubmitRun}
            >
              {!payoutConfigured
                ? "Private payouts unavailable"
                : submitState === "preparing"
                  ? "Prepare private deposit…"
                  : submitState === "submitting"
                    ? "Send private payouts…"
                    : rows.some((row) => row.rowStatus === "failed")
                      ? "Retry failed rows"
                      : "Send private payouts"}
            </Button>

            <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
              Private SOL-equivalent payouts are powered by wSOL and MagicBlock Private Payments.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
