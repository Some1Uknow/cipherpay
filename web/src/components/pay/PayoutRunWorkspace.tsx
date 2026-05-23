"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { publicConfig } from "@/lib/public-config";
import { assertSourceBalance, buildPayoutTransaction, resolvePaymentContract } from "@/lib/payout-runs/execution";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRunEntryMode } from "@/lib/payout-runs/types";
import {
  CSV_SAMPLE,
  createEmptyPayoutRow,
  ensureMinimumRows,
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
  const [rows, setRows] = useState<PayoutRowDraft[]>(() => ensureMinimumRows(initialRun?.rows ?? []));
  const [csvDraft, setCsvDraft] = useState(CSV_SAMPLE);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const initialSerialized = useMemo(
    () => serializeDraft(initialRun?.entryMode ?? "manual", ensureMinimumRows(initialRun?.rows ?? [])),
    [initialRun],
  );
  const lastSavedRef = useRef(initialSerialized);

  const issues = validateRows(rows);
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
  const { publicKey, sendTransaction, connected } = useWallet();
  const tokenConfigured = Boolean(publicConfig.phase1TokenMint);

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
    setRows((current) => ensureMinimumRows(current.length === 1 ? [createEmptyPayoutRow()] : current.filter((row) => row.id !== id)));
    setSubmitState("idle");
    setSubmitError(null);
  }

  function loadCsvIntoTable() {
    try {
      const parsedRows = parseCsvRows(csvDraft);
      setRows(ensureMinimumRows(parsedRows.length > 0 ? parsedRows : []));
      setCsvError(null);
      setSubmitState("idle");
      setSubmitError(null);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "CSV import failed.");
    }
  }

  function resetRun() {
    const nextRows = ensureMinimumRows([]);
    setRunId(null);
    setMode("manual");
    setRows(nextRows);
    setSaveState("idle");
    setSaveError(null);
    setSubmitState("idle");
    setSubmitError(null);
    lastSavedRef.current = serializeDraft("manual", nextRows);
  }

  async function persistRunStatus(params: {
    status: "draft" | "ready" | "submitting" | "submitted" | "failed" | "completed";
    rows: Array<{
      id: string;
      rowStatus: "draft" | "ready" | "submitted" | "confirmed" | "failed";
      txSignature?: string | null;
      errorMessage?: string | null;
    }>;
  }) {
    if (!runId) return;

    await fetch(`/api/payout-runs/${runId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  async function handleSubmitRun() {
    if (!runId) {
      setSubmitError("Save this draft before sending.");
      return;
    }

    if (!tokenConfigured) {
      setSubmitError("Set NEXT_PUBLIC_PHASE1_TOKEN_MINT before enabling live payouts.");
      return;
    }

    if (!connected || !publicKey || !sendTransaction) {
      setSubmitError("Connect the funding wallet before sending payouts.");
      return;
    }

    setSubmitState("preparing");
    setSubmitError(null);

    try {
      const contract = await resolvePaymentContract({
        connection,
        mintAddress: publicConfig.phase1TokenMint,
        fallbackDecimals: publicConfig.phase1TokenDecimals,
        symbol: publicConfig.phase1TokenSymbol,
      });

      const readyRows = rows.filter((row, index) => isRowFilled(row) && Object.keys(issues[index] ?? {}).length === 0);
      const { sourceAta } = await assertSourceBalance({
        connection,
        owner: publicKey,
        contract,
        rows: readyRows,
      });

      setSubmitState("submitting");
      await persistRunStatus({
        status: "submitting",
        rows: readyRows.map((row) => ({ id: row.id, rowStatus: "ready" })),
      });

      const nextRows = [...rows];
      let anyFailures = false;

      for (const row of readyRows) {
        const prepared = buildPayoutTransaction({
          payer: publicKey,
          sourceAta,
          contract,
          row,
        });

        try {
          const latestBlockhash = await connection.getLatestBlockhash("confirmed");
          prepared.transaction.feePayer = publicKey;
          prepared.transaction.recentBlockhash = latestBlockhash.blockhash;

          const signature = await sendTransaction(prepared.transaction, connection, {
            preflightCommitment: "confirmed",
            skipPreflight: false,
          });

          await persistRunStatus({
            status: "submitted",
            rows: [{ id: row.id, rowStatus: "submitted", txSignature: signature }],
          });

          const confirmation = await connection.confirmTransaction(
            {
              signature,
              blockhash: latestBlockhash.blockhash,
              lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
            },
            "confirmed",
          );

          if (confirmation.value.err) {
            throw new Error("Transaction confirmed with an on-chain error.");
          }

          const rowIndex = nextRows.findIndex((candidate) => candidate.id === row.id);
          if (rowIndex >= 0) {
            nextRows[rowIndex] = {
              ...nextRows[rowIndex],
              rowStatus: "confirmed",
              txSignature: signature,
              errorMessage: null,
            };
          }

          await persistRunStatus({
            status: "submitted",
            rows: [{ id: row.id, rowStatus: "confirmed", txSignature: signature }],
          });
        } catch (error) {
          anyFailures = true;
          const message = error instanceof Error ? error.message : "Payout failed.";
          const rowIndex = nextRows.findIndex((candidate) => candidate.id === row.id);
          if (rowIndex >= 0) {
            nextRows[rowIndex] = {
              ...nextRows[rowIndex],
              rowStatus: "failed",
              errorMessage: message,
            };
          }

          await persistRunStatus({
            status: "failed",
            rows: [{ id: row.id, rowStatus: "failed", errorMessage: message }],
          });
        }
      }

      setRows(nextRows);
      setSubmitState(anyFailures ? "failed" : "completed");

      await persistRunStatus({
        status: anyFailures ? "failed" : "completed",
        rows: nextRows
          .filter((row) => row.rowStatus === "confirmed" || row.rowStatus === "failed")
          .map((row) => ({
            id: row.id,
            rowStatus: row.rowStatus as "confirmed" | "failed",
            txSignature: row.txSignature,
            errorMessage: row.errorMessage,
          })),
      });
    } catch (error) {
      setSubmitState("failed");
      setSubmitError(error instanceof Error ? error.message : "Payout run failed.");
    }
  }

  useEffect(() => {
    if (draftFingerprint === lastSavedRef.current) return;

    setSaveState("dirty");
    setSaveError(null);

    const hasMeaningfulInput = filledRows.length > 0 || Boolean(runId);
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
        const nextRows = ensureMinimumRows(payload.run.rows);
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
  }, [draftFingerprint, filledRows.length, mode, rows, runId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Payout run</p>
                <CardTitle className="mt-2 text-[28px] tracking-[-0.045em] text-[var(--brand-ink-deep)]">Build one clean payout run</CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  Manual entry and CSV land in the same run. The right rail should answer whether you can send without forcing another screen.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">USDC only</Badge>
                <Badge tone="slate">Funding wallet: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</Badge>
                {runId ? <Badge tone="slate">Draft saved</Badge> : null}
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-[rgba(148,163,184,0.16)] bg-[var(--brand-surface-muted)] p-1.5">
              <button
                type="button"
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
                  mode === "manual"
                    ? "bg-white text-[var(--brand-primary)] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
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
                    ? "bg-white text-[var(--brand-primary)] shadow-[0_8px_18px_rgba(15,23,42,0.08)]"
                    : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink-deep)]",
                )}
                onClick={() => setMode("csv")}
              >
                CSV
              </button>
            </div>

            {mode === "csv" ? (
              <div className="mt-6 grid gap-4 rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-[var(--brand-surface-muted)] p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-[var(--brand-ink)]">Paste CSV rows</p>
                    <p className="text-sm text-[var(--brand-muted-ink)]">Use exactly: recipient_name, wallet_address, amount</p>
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
                  <p className="text-xs text-[var(--brand-muted-ink)]">Imported rows land in the same payout table as manual entry.</p>
                  <Button onClick={loadCsvIntoTable}>Use these rows</Button>
                </div>
                {csvError ? <p className="text-sm text-red-700">{csvError}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-[28px] border border-[rgba(148,163,184,0.14)] bg-white">
              <div className="hidden grid-cols-[1.1fr_1.4fr_0.7fr_140px] gap-3 border-b border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted-ink)] md:grid">
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
                      className="grid gap-3 bg-white px-5 py-5 md:grid-cols-[1.1fr_1.4fr_0.7fr_140px]"
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
                          ) : row.rowStatus === "confirmed" ? (
                            <Badge tone="green">Confirmed</Badge>
                          ) : row.rowStatus === "submitted" ? (
                            <Badge tone="blue">Submitted</Badge>
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
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--brand-muted-ink)]">
                The workspace is intentionally compact. Three to six payouts should fit cleanly before scrolling becomes necessary.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={resetRun}>
                  Start fresh
                </Button>
                <Button variant="secondary" onClick={addRow}>
                  Add row
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>This rail should make the send decision obvious in seconds.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--brand-muted-ink)]">Valid rows</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{validCount}</p>
              </div>
              <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] px-4 py-3">
                <p className="text-xs text-[var(--brand-muted-ink)]">Needs attention</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">{invalidCount}</p>
              </div>
              <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] px-4 py-3 sm:col-span-2 xl:col-span-1">
                <p className="text-xs text-[var(--brand-muted-ink)]">Total amount</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {publicConfig.phase1TokenSymbol}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Funding wallet</p>
              <p className="mt-2 break-all text-sm text-[var(--brand-ink-deep)]">{walletAddress}</p>
            </div>

            <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Run state</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {isReady
                  ? "Ready to send. Every current row passes validation."
                  : filledRows.length === 0
                    ? "Start by adding at least one payout row."
                    : "Fix the highlighted rows before sending."}
              </p>
            </div>

            <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] p-4">
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

            <div className="rounded-[24px] border border-[rgba(148,163,184,0.12)] bg-[var(--brand-surface-muted)] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Execution</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {!tokenConfigured
                  ? "Live payouts are disabled until a Phase 1 token mint is configured."
                  : submitState === "preparing"
                    ? "Checking token setup and funding balance…"
                    : submitState === "submitting"
                      ? "Sending one transaction per valid row…"
                      : submitState === "completed"
                        ? "All ready rows were confirmed."
                        : submitState === "failed"
                          ? "Some payouts failed. Review row-level status below."
                          : "Wallet-signed SPL token transfers will run one row at a time."}
              </p>
              {submitError ? <p className="mt-2 text-xs text-red-700">{submitError}</p> : null}
            </div>

            <Button
              size="lg"
              disabled={!isReady || !tokenConfigured || submitState === "preparing" || submitState === "submitting"}
              onClick={handleSubmitRun}
            >
              {!tokenConfigured
                ? "Configure payout mint to send"
                : submitState === "preparing"
                  ? "Preparing payout run…"
                  : submitState === "submitting"
                    ? "Sending payouts…"
                    : "Send payouts"}
            </Button>

            <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
              Draft persistence is already live. Sending uses the connected funding wallet and one configured SPL mint.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
