"use client";

import * as React from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/ui/code-block";
import { publicConfig } from "@/lib/public-config";
import type { PersistedPayoutRun } from "@/lib/payout-runs/types";

const examplePrompt = `Create a CipherPay draft:
Pay Northline Studio 0.018 SOL to GW91mC6M7xTnN4aMvQq5jQ9nG2L3w4LfA1uQw8fLm9rA for invoice INV-1042.`;

function mcpConfig(walletAddress: string) {
  const appUrl = (publicConfig.appUrl || "http://localhost:3000").replace(/\/$/, "");
  return `{
  "mcpServers": {
    "cipherpay": {
      "command": "pnpm",
      "args": ["--dir", "<path-to-cipherpay-repo>/web", "mcp:cipherpay"],
      "env": {
        "CIPHERPAY_APP_URL": "${appUrl}",
        "CIPHERPAY_MCP_TOKEN": "your-mcp-token",
        "CIPHERPAY_WALLET_ADDRESS": "${walletAddress}"
      }
    }
  }
}`;
}

function shortWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function approvalHref(run: PersistedPayoutRun) {
  const path = run.entryMode === "manual" ? "/pay" : "/bulk-pay";
  return `${path}?runId=${encodeURIComponent(run.id)}`;
}

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function AgentPayablesWorkspace({
  walletAddress,
  drafts,
}: {
  walletAddress: string;
  drafts: PersistedPayoutRun[];
}) {
  const config = React.useMemo(() => mcpConfig(walletAddress), [walletAddress]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4">
      <section className="rounded-[28px] bg-white/80 p-5 shadow-neoInsetSm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-ink)]">MCP server status</p>
            <p className="mt-1 text-sm leading-6 text-[var(--brand-muted-ink)]">
              AI can create drafts. Wallet approval still happens in CipherPay.
            </p>
            <p className="mt-3 font-mono text-xs text-[var(--brand-muted-ink)]">
              Funding wallet: {shortWallet(walletAddress)}
            </p>
          </div>
          <Link
            href="/docs"
            className="inline-flex h-11 min-w-fit items-center justify-center rounded-2xl bg-[var(--brand-surface)] px-4 text-sm font-medium text-[var(--brand-ink)] shadow-neoSm transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-[1px] hover:shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Docs
          </Link>
        </div>
      </section>

      <section className="rounded-[28px] bg-white/80 p-5 shadow-neoInsetSm sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">AI drafts</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--brand-muted-ink)]">
              Drafts created by your MCP client appear here before wallet approval.
            </p>
          </div>
          <Badge tone={drafts.length > 0 ? "blue" : "slate"}>{drafts.length} open</Badge>
        </div>

        <div className="mt-4 grid gap-3">
          {drafts.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-5 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">No AI drafts yet</p>
              <p className="mt-1 text-sm leading-6 text-[var(--brand-muted-ink)]">
                Ask your AI client to create a CipherPay draft. It will show up here when validation passes.
              </p>
            </div>
          ) : (
            drafts.map((draft) => (
              <div key={draft.id} className="rounded-2xl bg-white p-4 shadow-neoSm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--brand-ink)]">
                        {draft.itemCount} {draft.itemCount === 1 ? "recipient" : "recipients"}
                      </p>
                      <Badge tone={draft.status === "ready" ? "green" : "slate"}>{draft.status}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
                      {draft.totalAmount} {draft.assetSymbol} · {formatUpdatedAt(draft.lastInteractedAt)}
                    </p>
                  </div>
                  <Link
                    href={approvalHref(draft)}
                    className="inline-flex h-11 min-w-fit items-center justify-center rounded-2xl bg-[var(--brand-primary)] px-4 text-sm font-medium text-white shadow-neoSm transition-[box-shadow,transform,background-color,color] duration-300 ease-out hover:-translate-y-[1px] hover:bg-[var(--brand-primary-dark)] hover:shadow-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    Review & approve
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[28px] bg-[var(--brand-ink-deep)] p-5 shadow-neo sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-white">MCP client config</h2>
        </div>
        <CodeBlock code={config} className="mt-4" tone="dark" />
      </section>

      <section className="rounded-[28px] bg-white/80 p-5 shadow-neoInsetSm sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Example command</h2>
        <CodeBlock code={examplePrompt} className="mt-4" />
      </section>
    </div>
  );
}
