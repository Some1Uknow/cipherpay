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

function recipientCountLabel(count: number) {
  return `${count} ${count === 1 ? "recipient" : "recipients"}`;
}

function rowStatusTone(status: PayoutRowDraft["rowStatus"]) {
  if (status === "paid_private") return "green";
  if (status === "failed") return "amber";
  if (status === "paying" || status === "queued") return "blue";
  return "slate";
}

function entryModeLabel(entryMode: PersistedPayoutRun["entryMode"]) {
  return entryMode === "manual" ? "Manual pay" : "Bulk pay";
}

function runTitle(run: PersistedPayoutRun) {
  const label = entryModeLabel(run.entryMode);

  if (run.status === "completed") return `${label} completed`;
  if (run.status === "partially_paid") return `${label} partially paid`;
  if (run.status === "failed") return `${label} failed`;
  if (run.status === "recoverable") return `${label} needs recovery`;
  if (run.status === "paying") return `${label} in progress`;
  if (run.status === "depositing" || run.status === "deposit_confirmed") return `${label} preparing deposit`;
  if (run.status === "ready") return `${label} ready`;
  return `${label} draft`;
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
  const paidPrivateCount = countRows(run, "paid_private");
  const failedCount = countRows(run, "failed");
  const pendingCount = run.rows.filter((row) => row.rowStatus !== "paid_private" && row.rowStatus !== "failed").length;
  const uniquePrivateTxs = Array.from(new Set(run.rows.map((row) => row.privateWithdrawSignature ?? row.txSignature).filter(Boolean))) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(15,23,42,0.34)] px-4 py-5 backdrop-blur-[10px] sm:px-6 sm:py-7" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" aria-label="Close run details" onClick={onClose} />

      <div className="relative w-full max-w-[1120px] overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,248,255,0.94))] shadow-[0_28px_80px_rgba(15,23,42,0.18)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top,rgba(14,91,255,0.14),transparent_72%)]" />

        <div className="relative flex items-start justify-between gap-4 border-b border-[rgba(196,210,228,0.72)] px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-muted-ink)]">Run details</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] text-[var(--brand-ink-deep)]">{runTitle(run)}</h2>
            <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
              {recipientCountLabel(run.itemCount)} · {run.totalAmount} {run.assetSymbol} · Last updated {formatDate(run.lastInteractedAt)}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="relative max-h-[min(78dvh,820px)] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Funding wallet", shorten(run.walletAddress, 6)],
              ["Rail", run.payoutRail === "cloak" ? "Cloak private pool" : run.payoutRail],
              ["Asset", run.assetSymbol],
              ["Pay mode", entryModeLabel(run.entryMode)],
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
              ["Paid privately", paidPrivateCount, "text-emerald-700"],
              ["Failed", failedCount, "text-red-700"],
              ["Pending", pendingCount, "text-slate-600"],
              ["Transfer txs", uniquePrivateTxs.length, "text-[var(--brand-blue)]"],
            ].map(([label, value, className]) => (
              <div key={label} className="rounded-[22px] bg-[var(--brand-surface)] p-4 shadow-neoSm">
                <p className={cn("text-2xl font-semibold tracking-[-0.04em]", className as string)}>{value}</p>
                <p className="mt-1 text-xs font-medium text-[var(--brand-muted-ink)]">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            <div className="rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Private rail</p>
              <div className="mt-3 grid gap-2 text-xs text-[var(--brand-muted-ink)]">
                <p>Internal mint: <span className="break-all font-mono text-[var(--brand-ink)]">{run.assetMint ?? "Not recorded"}</span></p>
                <p>Cloak program: <span className="break-all font-mono text-[var(--brand-ink)]">{run.cloakProgramId ?? "Not recorded"}</span></p>
                <p>Relay: <span className="break-all font-mono text-[var(--brand-ink)]">{run.cloakRelayUrl ?? "Not recorded"}</span></p>
                <p>Status: <span className="font-semibold text-[var(--brand-ink)]">{run.privateStatus ?? run.status}</span></p>
              </div>
            </div>

            <div className="rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Deposit transaction</p>
              {run.privateDepositSignature ? (
                <a
                  className="mt-3 block break-all font-mono text-xs font-semibold text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                  href={explorerTxUrl(run.privateDepositSignature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {run.privateDepositSignature}
                </a>
              ) : (
                <p className="mt-3 text-xs text-[var(--brand-muted-ink)]">No deposit transaction recorded.</p>
              )}
            </div>
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
              <p className="text-xs text-[var(--brand-muted-ink)]">Cloak private withdraw signatures are shown as copyable text.</p>
            </div>

            <div className="overflow-hidden rounded-[26px] bg-[var(--brand-surface)] shadow-neoSm">
              <div className="hidden grid-cols-[1.4fr_1.2fr_0.7fr_0.7fr_1.2fr] gap-3 border-b border-white/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-muted-ink)] lg:grid">
                <span>Recipient</span>
                <span>Wallet</span>
                <span>Amount</span>
                <span>Status</span>
                <span>Private transfer</span>
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
                      {row.amount} {run.assetSymbol}
                    </p>
                    <Badge tone={rowStatusTone(row.rowStatus)}>{row.rowStatus === "paid_private" ? "paid_private" : row.rowStatus ?? "draft"}</Badge>
                    <div>
                      {row.privateWithdrawSignature ? (
                        <a
                          className="break-all font-mono text-xs font-semibold text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                          href={explorerTxUrl(row.privateWithdrawSignature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shorten(row.privateWithdrawSignature, 8)}
                        </a>
                      ) : row.txSignature ? (
                        <p className="break-all font-mono text-xs font-semibold text-[var(--brand-ink)]">
                          {row.txSignature}
                        </p>
                      ) : (
                        <span className="text-xs text-[var(--brand-muted-ink)]">No private transfer tx yet</span>
                      )}
                      {row.clientRefId ? <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">Ref {row.clientRefId}</p> : null}
                      {row.errorMessage ? <p className="mt-1 text-xs text-red-700">{row.errorMessage}</p> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {uniquePrivateTxs.length > 0 ? (
            <div className="mt-5 rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Private transfer transactions</p>
              <div className="mt-3 grid gap-2">
                {uniquePrivateTxs.map((signature) => (
                  <p
                    key={signature}
                    className="break-all rounded-2xl px-3 py-2 font-mono text-xs font-semibold text-[var(--brand-ink)]"
                  >
                    {signature}
                  </p>
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
        description="Manual and bulk payout drafts appear here automatically."
        actionLabel="Start a payment"
        actionHref="/pay"
      />
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between rounded-[24px] bg-[var(--brand-surface)] px-4 py-3 shadow-neoInsetSm">
        <p className="text-sm font-semibold text-[var(--brand-ink)]">{runs.length} payout runs</p>
        <p className="text-xs text-[var(--brand-muted-ink)]">Newest first</p>
      </div>

      <div className="grid content-start gap-3.5">
        {runs.map((run) => (
          <button key={run.id} type="button" className="block w-full text-left" onClick={() => setSelectedRunId(run.id)}>
            <Card className="transition duration-200 hover:-translate-y-0.5 hover:shadow-neoLg">
              <CardContent className="flex flex-col gap-3 px-5 py-5 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{runTitle(run)}</p>
                  <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
                    {formatDate(run.lastInteractedAt)} · {recipientCountLabel(run.itemCount)} · {countRows(run, "paid_private")} paid
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-left sm:items-end">
                  <p className="text-sm font-medium text-[var(--brand-ink)]">
                    {run.totalAmount} {run.assetSymbol}
                  </p>
                  <Badge tone="blue">{entryModeLabel(run.entryMode)}</Badge>
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
