"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatBaseUnits } from "@/lib/cloak/amounts";
import { getPrivatePayoutAsset, isCloakPrivateRailEnabled } from "@/lib/cloak/config";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRunEntryMode } from "@/lib/payout-runs/types";
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [privateBalance, setPrivateBalance] = useState<string | null>(initialRun?.privateBalanceAfter ?? initialRun?.privateBalanceBefore ?? null);
  const [depositNeeded, setDepositNeeded] = useState<string | null>(null);
  const [paidPrivateCount, setPaidPrivateCount] = useState(() => {
    const sourceRows = entryMode === "manual" ? initialRun?.rows.slice(0, 1) : initialRun?.rows;
    return sourceRows?.filter((row) => row.rowStatus === "paid_private").length ?? 0;
  });
  const privateAsset = useMemo(() => getPrivatePayoutAsset(), []);
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
  const { publicKey, connected } = useWallet();
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
    const nextRows: PayoutRowDraft[] = entryMode === "manual" ? [createEmptyPayoutRow()] : [];
    setRunId(null);
    setRows(nextRows);
    setCsvDraft(CSV_SAMPLE);
    setCsvError(null);
    setSaveState("idle");
    setSaveError(null);
    setSubmitState("idle");
    setSubmitError(null);
    setPrivateBalance(null);
    setDepositNeeded(null);
    setPaidPrivateCount(0);
    lastSavedRef.current = serializeDraft(entryMode, nextRows);
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

    if (!connected || !publicKey) {
      setSubmitError("Connect the funding wallet before sending payouts.");
      return;
    }

    setSubmitState("failed");
    setSubmitError("Cloak execution is not wired yet. Phase 4 and Phase 5 add manual and bulk Cloak sends.");
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="grid gap-6">
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
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="secondary" onClick={resetRun}>
                    Clear form
                  </Button>
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
                <p className="text-xs text-[var(--brand-muted-ink)]">{entryMode === "manual" ? "Recipient" : "Valid rows"}</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink-deep)]">
                  {entryMode === "manual" ? (filledRows.length > 0 ? 1 : 0) : validCount}
                </p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm px-4 py-3">
                <p className="text-xs text-[var(--brand-muted-ink)]">{entryMode === "manual" ? "Needs attention" : "Needs attention"}</p>
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
                  ? entryMode === "manual"
                    ? "Ready to send this payout through the private rail."
                    : "Ready to send through the private payout rail."
                  : filledRows.length === 0
                    ? entryMode === "manual"
                      ? "Start by entering one recipient and one amount."
                      : "Start by adding at least one payout row."
                    : "Fix the highlighted rows before sending."}
              </p>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] shadow-neoInsetSm p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Funding source</p>
              <p className="mt-2 text-sm text-[var(--brand-ink-deep)]">
                {privateBalance
                  ? `${formatBaseUnits(privateBalance, privateAsset.decimals)} ${privateAsset.symbol} private balance from an earlier attempt detected. New sends use the funding wallet.`
                  : "Uses the connected funding wallet."}
              </p>
              {depositNeeded ? (
                <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">
                  Wallet amount needed: {formatBaseUnits(depositNeeded, privateAsset.decimals)} {privateAsset.symbol}
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
                    ? "Preparing the Cloak private transfer…"
                  : submitState === "submitting"
                      ? entryMode === "manual"
                        ? "Sending the private transfer…"
                        : "Sending private transfers…"
                      : submitState === "completed"
                        ? entryMode === "manual"
                          ? "The recipient was paid privately."
                          : "All ready rows were paid privately."
                        : submitState === "failed"
                          ? "Some payouts failed. Review row-level status below."
                      : entryMode === "manual"
                        ? "CipherPay will use Cloak to send a private transfer to the recipient wallet."
                        : "CipherPay will use Cloak to send private transfers to recipient wallets."}
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
                  ? "Prepare private transfer…"
                  : submitState === "submitting"
                    ? entryMode === "manual"
                      ? "Send payment…"
                      : "Send private payouts…"
                    : rowsToPersist.some((row) => row.rowStatus === "failed")
                      ? entryMode === "manual"
                        ? "Retry payment"
                        : "Retry failed rows"
                      : entryMode === "manual"
                        ? "Send payment"
                        : "Send private payouts"}
            </Button>

            <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
              Private payouts are migrating to Cloak. Execution will be enabled in the Cloak send phases.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
