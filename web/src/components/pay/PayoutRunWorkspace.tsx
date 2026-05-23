"use client";

import { useId, useState } from "react";
import { PublicKey } from "@solana/web3.js";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type EntryMode = "manual" | "csv";

type PayoutRow = {
  id: string;
  recipientName: string;
  walletAddress: string;
  amount: string;
};

type RowIssue = {
  recipientName?: string;
  walletAddress?: string;
  amount?: string;
  row?: string;
};

const CSV_SAMPLE = `recipient_name,wallet_address,amount
Ava Patel,9B3Y2dXhN6LQW8dyL5o6z8UZqv2q1X3dQ5bTA2sQkz4J,1850
Northline Studio,GW91mC6M7xTnN4aMvQq5jQ9nG2L3w4LfA1uQw8fLm9rA,3200`;

function makeRow(): PayoutRow {
  return {
    id: crypto.randomUUID(),
    recipientName: "",
    walletAddress: "",
    amount: "",
  };
}

function validateRows(rows: PayoutRow[]) {
  const duplicates = new Set<string>();
  const seen = new Set<string>();

  for (const row of rows) {
    const key = `${row.walletAddress.trim().toLowerCase()}::${row.amount.trim()}`;
    if (!row.walletAddress.trim() || !row.amount.trim()) continue;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }

  return rows.map((row) => {
    const issues: RowIssue = {};

    if (!row.recipientName.trim()) issues.recipientName = "Add a recipient name.";

    if (!row.walletAddress.trim()) {
      issues.walletAddress = "Add a Solana wallet address.";
    } else {
      try {
        new PublicKey(row.walletAddress.trim());
      } catch {
        issues.walletAddress = "Use a valid Solana wallet address.";
      }
    }

    if (!row.amount.trim()) {
      issues.amount = "Add an amount.";
    } else {
      const normalized = Number(row.amount);
      if (!Number.isFinite(normalized)) {
        issues.amount = "Use a number like 1250 or 1250.50.";
      } else if (normalized <= 0) {
        issues.amount = "Amount must be greater than zero.";
      } else if (!/^\d+(\.\d{1,2})?$/.test(row.amount.trim())) {
        issues.amount = "Use up to 2 decimal places for USDC.";
      }
    }

    const duplicateKey = `${row.walletAddress.trim().toLowerCase()}::${row.amount.trim()}`;
    if (!issues.walletAddress && !issues.amount && duplicates.has(duplicateKey)) {
      issues.row = "Duplicate wallet and amount detected.";
    }

    return issues;
  });
}

function parseCsvRows(csvText: string): PayoutRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const [header, ...dataLines] = lines;
  const headerParts = header.split(",").map((part) => part.trim().toLowerCase());
  const expected = ["recipient_name", "wallet_address", "amount"];

  if (expected.some((field, index) => headerParts[index] !== field)) {
    throw new Error("Use the CSV columns recipient_name,wallet_address,amount in that order.");
  }

  return dataLines.map((line) => {
    const [recipientName = "", walletAddress = "", amount = ""] = line.split(",").map((part) => part.trim());
    return {
      id: crypto.randomUUID(),
      recipientName,
      walletAddress,
      amount,
    };
  });
}

export function PayoutRunWorkspace({ walletAddress }: { walletAddress: string }) {
  const amountId = useId();
  const [mode, setMode] = useState<EntryMode>("manual");
  const [rows, setRows] = useState<PayoutRow[]>([makeRow(), makeRow(), makeRow()]);
  const [csvDraft, setCsvDraft] = useState(CSV_SAMPLE);
  const [csvError, setCsvError] = useState<string | null>(null);

  const issues = validateRows(rows);
  const validCount = issues.filter((issue) => Object.keys(issue).length === 0).length;
  const invalidCount = issues.length - validCount;
  const filledRows = rows.filter((row) => row.recipientName || row.walletAddress || row.amount);
  const total = rows.reduce((sum, row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return sum;
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const isReady = filledRows.length > 0 && invalidCount === 0;

  function updateRow(id: string, field: keyof Omit<PayoutRow, "id">, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, makeRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length === 1 ? [makeRow()] : current.filter((row) => row.id !== id)));
  }

  function loadCsvIntoTable() {
    try {
      const parsedRows = parseCsvRows(csvDraft);
      setRows(parsedRows.length > 0 ? parsedRows : [makeRow(), makeRow(), makeRow()]);
      setCsvError(null);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "CSV import failed.");
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
      <div className="grid gap-6">
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--brand-primary)]">Payout run</p>
                <CardTitle className="mt-2 text-[28px] tracking-[-0.04em]">Build one clean payout run</CardTitle>
                <CardDescription className="mt-2 max-w-2xl">
                  Add rows by hand or bring in a CSV. Review the run in the rail before wiring execution.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">USDC only</Badge>
                <Badge tone="slate">Funding wallet: {walletAddress.slice(0, 4)}…{walletAddress.slice(-4)}</Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium",
                  "bg-[var(--brand-surface)] shadow-neoSm transition-[box-shadow,color] duration-300",
                  mode === "manual"
                    ? "text-[var(--brand-primary)] shadow-neoInsetSm"
                    : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)] hover:shadow-neo",
                )}
                onClick={() => setMode("manual")}
              >
                Manual
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium",
                  "bg-[var(--brand-surface)] shadow-neoSm transition-[box-shadow,color] duration-300",
                  mode === "csv"
                    ? "text-[var(--brand-primary)] shadow-neoInsetSm"
                    : "text-[var(--brand-muted-ink)] hover:text-[var(--brand-ink)] hover:shadow-neo",
                )}
                onClick={() => setMode("csv")}
              >
                CSV
              </button>
            </div>

            {mode === "csv" ? (
              <div className="mt-6 grid gap-4 rounded-[28px] bg-[var(--brand-surface)] p-5 shadow-neoInsetDeep">
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
                  <p className="text-xs text-[var(--brand-muted-ink)]">
                    Imported rows land in the same payout table as manual entry.
                  </p>
                  <Button onClick={loadCsvIntoTable}>Use these rows</Button>
                </div>
                {csvError ? <p className="text-sm text-red-700">{csvError}</p> : null}
              </div>
            ) : null}

            <div className="mt-6 overflow-hidden rounded-[28px] bg-[var(--brand-surface)] shadow-neoInsetDeep">
              <div className="hidden grid-cols-[1.1fr_1.4fr_0.7fr_140px] gap-3 bg-[var(--brand-surface)] px-5 py-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted-ink)] shadow-neoInsetSm md:grid">
                <span>Recipient</span>
                <span>Wallet</span>
                <span id={amountId}>Amount</span>
                <span>Status</span>
              </div>

              <div className="grid gap-0 divide-y divide-[rgba(163,177,198,0.35)]">
                {rows.map((row, index) => {
                  const rowIssues = issues[index] ?? {};
                  const rowHasIssues = Object.keys(rowIssues).length > 0;
                  return (
                    <div
                      key={row.id}
                      className="grid gap-3 bg-[var(--brand-surface)] px-5 py-5 md:grid-cols-[1.1fr_1.4fr_0.7fr_140px]"
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
                          ) : row.recipientName || row.walletAddress || row.amount ? (
                            <Badge tone="green">Ready</Badge>
                          ) : (
                            <Badge tone="slate">Empty</Badge>
                          )}
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
                Start small. This view is designed so 3 to 6 payouts fit comfortably before any meaningful scrolling.
              </p>
              <Button variant="secondary" onClick={addRow}>
                Add row
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="xl:sticky xl:top-24">
        <Card>
          <CardHeader>
            <CardTitle>Review</CardTitle>
            <CardDescription>Use this rail to decide whether the run is ready. It should replace guesswork, not add steps.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pt-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm">
                <p className="text-xs text-[var(--brand-muted-ink)]">Valid rows</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">{validCount}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm">
                <p className="text-xs text-[var(--brand-muted-ink)]">Needs attention</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">{invalidCount}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm sm:col-span-2 xl:col-span-1">
                <p className="text-xs text-[var(--brand-muted-ink)]">Total amount</p>
                <p className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--brand-ink)]">
                  {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                </p>
              </div>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Funding wallet</p>
              <p className="mt-2 break-all text-sm text-[var(--brand-ink)]">{walletAddress}</p>
            </div>

            <div className="rounded-[24px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">Run state</p>
              <p className="mt-2 text-sm text-[var(--brand-ink)]">
                {isReady
                  ? "Ready to wire into submission. Every current row passes client validation."
                  : filledRows.length === 0
                    ? "Start by adding at least one payout row."
                    : "Fix the highlighted rows before this run is ready."}
              </p>
            </div>

            <Button size="lg" disabled={!isReady}>
              {isReady ? "Review payout run" : "Fix rows to continue"}
            </Button>

            <p className="text-xs leading-6 text-[var(--brand-muted-ink)]">
              Execution, persistence, and on-chain receipts are the next implementation layer. This page fixes the product shape first.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
