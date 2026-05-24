"use client";

import { useMemo, useState } from "react";

import { EmptyStateCard } from "@/components/layout/EmptyStateCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PersistedPayoutRun, PayoutRowDraft } from "@/lib/payout-runs/types";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";

type PayoutHistoryListProps = {
  runs: PersistedPayoutRun[];
};

function formatDate(value: string | null) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function explorerTxUrl(signature: string) {
  const cluster = publicConfig.solanaCluster === "mainnet-beta" ? "" : `?cluster=${publicConfig.solanaCluster}`;
  return `https://explorer.solana.com/tx/${signature}${cluster}`;
}

function explorerAddressUrl(address: string) {
  const cluster = publicConfig.solanaCluster === "mainnet-beta" ? "" : `?cluster=${publicConfig.solanaCluster}`;
  return `https://explorer.solana.com/address/${address}${cluster}`;
}

function shorten(value: string, edge = 5) {
  if (value.length <= edge * 2 + 3) return value;
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

function rowStatusTone(status: PayoutRowDraft["rowStatus"]) {
  if (status === "confirmed") return "green";
  if (status === "failed") return "amber";
  if (status === "submitted") return "blue";
  return "slate";
}

function runTitle(run: PersistedPayoutRun) {
  if (run.status === "completed") return "Completed payout run";
  if (run.status === "failed") return "Failed payout run";
  if (run.status === "submitted" || run.status === "submitting") return "Submitted payout run";
  if (run.status === "ready") return "Ready payout run";
  return "Draft payout run";
}

function countRows(run: PersistedPayoutRun, status: PayoutRowDraft["rowStatus"]) {
  return run.rows.filter((row) => row.rowStatus === status).length;
}

function RunDetailModal({
  run,
  onClose,
}: {
  run: PersistedPayoutRun;
  onClose: () => void;
}) {
  const confirmedCount = countRows(run, "confirmed");
  const failedCount = countRows(run, "failed");
  const pendingCount = run.rows.filter((row) => row.rowStatus !== "confirmed" && row.rowStatus !== "failed").length;
  const uniqueSettlementTxs = Array.from(new Set(run.rows.map((row) => row.txSignature).filter(Boolean))) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/28 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-[32px] bg-[var(--brand-surface)] shadow-neoLg">
        <div className="flex items-start justify-between gap-4 border-b border-white/70 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Run details</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[var(--brand-ink-deep)]">{runTitle(run)}</h2>
            <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
              {run.itemCount} recipients · {run.totalAmount} {publicConfig.phase1TokenSymbol} · Last updated {formatDate(run.lastInteractedAt)}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-5 py-5 sm:px-7">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Funding wallet", shorten(run.walletAddress, 6)],
              ["Entry mode", run.entryMode.toUpperCase()],
              ["Created", formatDate(run.createdAt)],
              ["Submitted", formatDate(run.submittedAt)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[22px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-muted-ink)]">{label}</p>
                <p className="mt-2 break-words text-sm font-semibold text-[var(--brand-ink)]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {[
              ["Confirmed", confirmedCount, "text-emerald-700"],
              ["Failed", failedCount, "text-red-700"],
              ["Pending", pendingCount, "text-slate-600"],
              ["Settlement txs", uniqueSettlementTxs.length, "text-[var(--brand-blue)]"],
            ].map(([label, value, className]) => (
              <div key={label} className="rounded-[22px] bg-[var(--brand-surface)] p-4 shadow-neoSm">
                <p className={cn("text-2xl font-semibold tracking-[-0.04em]", className as string)}>{value}</p>
                <p className="mt-1 text-xs font-medium text-[var(--brand-muted-ink)]">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--brand-ink)]">Funding wallet</p>
                <p className="mt-1 break-all font-mono text-xs text-[var(--brand-muted-ink)]">{run.walletAddress}</p>
              </div>
              <a
                className="text-sm font-semibold text-[var(--brand-blue)] transition hover:text-[var(--brand-blue-strong)]"
                href={explorerAddressUrl(run.walletAddress)}
                target="_blank"
                rel="noreferrer"
              >
                View wallet on Explorer
              </a>
            </div>
          </div>

          <div className="mt-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--brand-muted-ink)]">Recipients</p>
              <p className="text-xs text-[var(--brand-muted-ink)]">One settlement transaction can cover multiple recipients.</p>
            </div>

            <div className="overflow-hidden rounded-[26px] bg-[var(--brand-surface)] shadow-neoSm">
              <div className="hidden grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_1.2fr] gap-3 border-b border-white/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-muted-ink)] lg:grid">
                <span>Recipient</span>
                <span>Wallet</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Settlement</span>
              </div>

              <div className="divide-y divide-white/80">
                {run.rows.map((row, index) => (
                  <div key={row.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_1.2fr] lg:items-center">
                    <div>
                      <p className="text-sm font-semibold text-[var(--brand-ink)]">{row.recipientName || `Recipient ${index + 1}`}</p>
                      <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">Row {index + 1}</p>
                    </div>
                    <a
                      className="break-all font-mono text-xs text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                      href={explorerAddressUrl(row.walletAddress)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.walletAddress}
                    </a>
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">
                      {row.amount} {publicConfig.phase1TokenSymbol}
                    </p>
                    <Badge tone={rowStatusTone(row.rowStatus)}>{row.rowStatus ?? "draft"}</Badge>
                    <div>
                      {row.txSignature ? (
                        <a
                          className="break-all font-mono text-xs font-semibold text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                          href={explorerTxUrl(row.txSignature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shorten(row.txSignature, 8)}
                        </a>
                      ) : (
                        <span className="text-xs text-[var(--brand-muted-ink)]">No settlement tx yet</span>
                      )}
                      {row.errorMessage ? <p className="mt-1 text-xs text-red-700">{row.errorMessage}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {uniqueSettlementTxs.length > 0 ? (
            <div className="mt-5 rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Settlement transactions</p>
              <div className="mt-3 grid gap-2">
                {uniqueSettlementTxs.map((signature) => (
                  <a
                    key={signature}
                    className="break-all rounded-2xl px-3 py-2 font-mono text-xs font-semibold text-[var(--brand-blue)] transition hover:bg-white/60"
                    href={explorerTxUrl(signature)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {signature}
                  </a>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PayoutHistoryList({ runs }: PayoutHistoryListProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const selectedRun = useMemo(() => runs.find((run) => run.id === selectedRunId) ?? null, [runs, selectedRunId]);

  if (runs.length === 0) {
    return (
      <EmptyStateCard
        title="No payout runs yet"
        description="Drafts you create in /pay show up here automatically."
        actionLabel="Start a payout run"
        actionHref="/pay"
      />
    );
  }

  return (
    <>
      <div className="grid gap-4">
        {runs.map((run) => (
          <button key={run.id} type="button" className="text-left" onClick={() => setSelectedRunId(run.id)}>
            <Card className="transition duration-200 hover:-translate-y-0.5 hover:shadow-neoLg">
              <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{runTitle(run)}</p>
                  <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
                    {formatDate(run.lastInteractedAt)} · {run.itemCount} rows · {countRows(run, "confirmed")} confirmed
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-left sm:items-end">
                  <p className="text-sm font-medium text-[var(--brand-ink)]">
                    {run.totalAmount} {publicConfig.phase1TokenSymbol}
                  </p>
                  <Badge tone={run.status === "completed" ? "green" : run.status === "failed" ? "amber" : "slate"}>{run.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      {selectedRun ? <RunDetailModal run={selectedRun} onClose={() => setSelectedRunId(null)} /> : null}
    </>
  );
}
