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
  if (status === "confirmed" || status === "paid_private") return "green";
  if (status === "failed") return "amber";
  if (status === "submitted" || status === "queued") return "blue";
  return "slate";
}

function runTitle(run: PersistedPayoutRun) {
  if (run.status === "completed") return "Completed payout run";
  if (run.status === "partially_paid") return "Partially paid private run";
  if (run.status === "failed") return "Failed payout run";
  if (run.status === "transferring") return "Private transfers in progress";
  if (run.status === "depositing" || run.status === "deposit_required" || run.status === "deposit_confirmed") return "Private deposit run";
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
  const paidPrivateCount = countRows(run, "paid_private");
  const failedCount = countRows(run, "failed");
  const pendingCount = run.rows.filter((row) => row.rowStatus !== "confirmed" && row.rowStatus !== "paid_private" && row.rowStatus !== "failed").length;
  const uniquePrivateTxs = Array.from(new Set(run.rows.map((row) => row.magicblockTransferSignature ?? row.txSignature).filter(Boolean))) as string[];

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
              {run.itemCount} recipients · {run.totalAmount} {run.assetSymbol} · Last updated {formatDate(run.lastInteractedAt)}
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
              ["Rail", run.payoutRail === "magicblock_private_spl" ? "Private" : run.payoutRail],
              ["Asset", run.assetSymbol],
              ["Entry mode", run.entryMode.toUpperCase()],
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
              ["Paid privately", paidPrivateCount || confirmedCount, "text-emerald-700"],
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
                <p>MagicBlock validator: <span className="break-all font-mono text-[var(--brand-ink)]">{run.magicblockValidator ?? "Not recorded"}</span></p>
                <p>Status: <span className="font-semibold text-[var(--brand-ink)]">{run.magicblockPrivateStatus ?? run.status}</span></p>
              </div>
            </div>

            <div className="rounded-[26px] bg-[var(--brand-surface)] p-4 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Deposit transaction</p>
              {run.magicblockDepositSignature ? (
                run.magicblockDepositSendTo === "base" ? (
                  <a
                    className="mt-3 block break-all font-mono text-xs font-semibold text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                    href={explorerTxUrl(run.magicblockDepositSignature)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {run.magicblockDepositSignature}
                  </a>
                ) : (
                  <p className="mt-3 break-all font-mono text-xs font-semibold text-[var(--brand-ink)]">{run.magicblockDepositSignature}</p>
                )
              ) : (
                <p className="mt-3 text-xs text-[var(--brand-muted-ink)]">No deposit transaction recorded.</p>
              )}
              <p className="mt-2 text-xs text-[var(--brand-muted-ink)]">sendTo: {run.magicblockDepositSendTo ?? "not recorded"}</p>
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
              <p className="text-xs text-[var(--brand-muted-ink)]">Private transfer signatures from the ER are shown as copyable text.</p>
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
                      {row.magicblockTransferSignature && row.magicblockTransferSendTo === "base" ? (
                        <a
                          className="break-all font-mono text-xs font-semibold text-[var(--brand-blue)] hover:text-[var(--brand-blue-strong)]"
                          href={explorerTxUrl(row.magicblockTransferSignature)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {shorten(row.magicblockTransferSignature, 8)}
                        </a>
                      ) : row.magicblockTransferSignature ?? row.txSignature ? (
                        <p className="break-all font-mono text-xs font-semibold text-[var(--brand-ink)]">
                          {row.magicblockTransferSignature ?? row.txSignature}
                        </p>
                      ) : (
                        <span className="text-xs text-[var(--brand-muted-ink)]">No private transfer tx yet</span>
                      )}
                      {row.clientRefId ? <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">Ref {row.clientRefId}</p> : null}
                      {row.magicblockTransferSendTo ? <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">sendTo {row.magicblockTransferSendTo}</p> : null}
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
        description="Drafts you create in /pay show up here automatically."
        actionLabel="Start a payout run"
        actionHref="/pay"
      />
    );
  }

  return (
    <>
      <div className="grid content-start gap-3.5">
        {runs.map((run) => (
          <button key={run.id} type="button" className="block w-full text-left" onClick={() => setSelectedRunId(run.id)}>
            <Card className="transition duration-200 hover:-translate-y-0.5 hover:shadow-neoLg">
              <CardContent className="flex flex-col gap-3 px-5 py-5 sm:px-6 sm:py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{runTitle(run)}</p>
                  <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
                    {formatDate(run.lastInteractedAt)} · {run.itemCount} rows · {countRows(run, "paid_private") || countRows(run, "confirmed")} paid
                  </p>
                </div>
                <div className="flex flex-col gap-2 text-left sm:items-end">
                  <p className="text-sm font-medium text-[var(--brand-ink)]">
                    {run.totalAmount} {run.assetSymbol}
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
