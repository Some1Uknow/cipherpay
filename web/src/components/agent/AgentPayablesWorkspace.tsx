"use client";

import * as React from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

import { formatBaseUnits, solInputToBaseUnits } from "@/lib/agent-pay/amounts";
import { AGENT_PAY_SKILL_INSTALL } from "@/lib/agent-pay/protocol";
import type { AgentPayOverview, LinkedAgent } from "@/lib/agent-pay/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function short(value: string) {
  return value.length > 14 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function agentInstruction(code: string | null) {
  return `Link yourself to CipherPay with code ${code ?? "XXXX-XXXX"}. Use handle my-agent-name. Set yourself up step by step.`;
}

function activityTitle(eventType: string, status: string) {
  if (eventType === "agent_funded" && status === "pending_wallet_signature") return "funding intent started";
  return eventType.replaceAll("_", " ");
}

function policyModeLabel(mode: LinkedAgent["policyMode"]) {
  return mode === "autonomous" ? "Autonomous with limits" : "Approval required";
}

function Panel({
  title,
  children,
  right,
  className,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-[var(--brand-border)] bg-white shadow-neoSm", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--brand-border)] px-4 py-3">
        <h2 className="font-mono text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--brand-ink)]">{title}</h2>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function AgentCard({ agent, onRefresh }: { agent: LinkedAgent; onRefresh: () => void }) {
  const { connection } = useConnection();
  const { publicKey, signMessage, signTransaction } = useWallet();
  const [amount, setAmount] = React.useState("0.01");
  const [policyMode, setPolicyMode] = React.useState(agent.policyMode);
  const [perTxLimit, setPerTxLimit] = React.useState(agent.perTxLimitBaseUnits ? formatBaseUnits(agent.perTxLimitBaseUnits) : "");
  const [rollingLimit, setRollingLimit] = React.useState(agent.rolling24hLimitBaseUnits ? formatBaseUnits(agent.rolling24hLimitBaseUnits) : "");
  const [publicWithdrawals, setPublicWithdrawals] = React.useState(agent.publicWithdrawalsEnabled);
  const [error, setError] = React.useState<string | null>(null);
  const [fundingStatus, setFundingStatus] = React.useState<string | null>(null);
  const [proofProgress, setProofProgress] = React.useState<number | null>(null);
  const [fundingPending, setFundingPending] = React.useState(false);
  const [policyPending, setPolicyPending] = React.useState(false);
  const [policyStatus, setPolicyStatus] = React.useState<"idle" | "saved">("idle");

  React.useEffect(() => {
    setPolicyMode(agent.policyMode);
    setPerTxLimit(agent.perTxLimitBaseUnits ? formatBaseUnits(agent.perTxLimitBaseUnits) : "");
    setRollingLimit(agent.rolling24hLimitBaseUnits ? formatBaseUnits(agent.rolling24hLimitBaseUnits) : "");
    setPublicWithdrawals(agent.publicWithdrawalsEnabled);
  }, [agent.perTxLimitBaseUnits, agent.policyMode, agent.publicWithdrawalsEnabled, agent.rolling24hLimitBaseUnits]);

  async function postPolicy(body: unknown) {
    setError(null);
    setPolicyStatus("idle");
    setPolicyPending(true);
    try {
      const response = await fetch("/api/agent-pay/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(result?.error ?? "Could not save Agent Pay policy.");
        return;
      }
      setPolicyStatus("saved");
      onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save Agent Pay policy.");
    } finally {
      setPolicyPending(false);
    }
  }

  async function fundAgent() {
    setError(null);
    setFundingStatus(null);
    setProofProgress(null);

    if (!publicKey || !signTransaction || !signMessage) {
      setError("Connect a wallet that can sign transactions and messages before funding an agent.");
      return;
    }
    if (publicKey.toBase58() !== agent.ownerWalletAddress) {
      setError(`Connect the owner wallet ${short(agent.ownerWalletAddress)} before funding this agent.`);
      return;
    }

    let amountBaseUnits: string;
    try {
      amountBaseUnits = solInputToBaseUnits(amount);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Invalid funding amount.");
      return;
    }

    setFundingPending(true);
    try {
      const { fundAgentWithCloak } = await import("@/lib/cloak/agent-funding");
      const result = await fundAgentWithCloak({
        amountBaseUnits: BigInt(amountBaseUnits),
        owner: publicKey,
        connection,
        signTransaction,
        signMessage,
        onPhase: (phase) => {
          setFundingStatus(
            phase === "proof"
              ? "Generating Cloak deposit proof."
              : phase === "submit"
                ? "Confirm the funding transaction in your wallet."
                : "Funding deposit confirmed.",
          );
        },
        onProgress: setFundingStatus,
        onProofProgress: setProofProgress,
      });

      setFundingStatus("Recording confirmed agent funding.");
      const response = await fetch("/api/agent-pay/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "fund",
          agentId: agent.id,
          amountSol: amount,
          depositSignature: result.depositSignature,
          depositCommitment: result.depositCommitment,
          serializedUtxo: result.serializedUtxo,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Cloak deposit confirmed, but CipherPay could not record the agent funding.");
      }

      setFundingStatus("Agent funded.");
      onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Agent funding failed.");
    } finally {
      setFundingPending(false);
    }
  }

  function savePolicy() {
    if (policyMode === "autonomous" && (!perTxLimit.trim() || !rollingLimit.trim())) {
      setError("Autonomous mode requires both a per-transaction limit and a rolling 24h limit.");
      return;
    }
    void postPolicy({
      action: "policy",
      agentId: agent.id,
      policyMode,
      perTxLimitSol: perTxLimit,
      rolling24hLimitSol: rollingLimit,
      publicWithdrawalsEnabled: publicWithdrawals,
    });
  }

  const currentPerTxLimit = agent.perTxLimitBaseUnits ? `${formatBaseUnits(agent.perTxLimitBaseUnits, agent.assetDecimals)} ${agent.assetSymbol}` : "Not set";
  const currentRollingLimit = agent.rolling24hLimitBaseUnits ? `${formatBaseUnits(agent.rolling24hLimitBaseUnits, agent.assetDecimals)} ${agent.assetSymbol}` : "Not set";

  return (
    <div className="grid gap-3 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--brand-ink)]">@{agent.handle}</h3>
            <Badge tone={agent.status === "active" ? "green" : "slate"}>{agent.status}</Badge>
            <Badge tone={agent.policyMode === "autonomous" ? "blue" : "amber"}>{agent.policyMode.replace("_", " ")}</Badge>
          </div>
          <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">{agent.displayName}</p>
          <p className="mt-1 font-mono text-xs text-[var(--brand-muted-ink)]">agent wallet {short(agent.agentWalletAddress)}</p>
        </div>
        <div className="border border-[#111] bg-white px-3 py-2 text-right shadow-neoSm">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--brand-muted-ink)]">shielded balance</p>
          <p className="text-lg font-semibold text-[var(--brand-ink)]">
            {formatBaseUnits(agent.shieldedBalanceBaseUnits, agent.assetDecimals)} {agent.assetSymbol}
          </p>
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--brand-border)] pt-3 sm:grid-cols-[1fr_auto]">
        <Input value={amount} onChange={(event) => setAmount(event.target.value)} aria-label={`Fund ${agent.handle} amount`} />
        <Button disabled={fundingPending} onClick={fundAgent}>
          {fundingPending ? "Funding..." : "Fund agent"}
        </Button>
      </div>
      {fundingStatus ? (
        <div className="border border-[var(--brand-border)] bg-white px-3 py-2 text-xs leading-5 text-[var(--brand-muted-ink)]">
          <span className="font-semibold text-[var(--brand-ink)]">{fundingStatus}</span>
          {proofProgress !== null ? <span className="ml-2 font-mono">{proofProgress}%</span> : null}
        </div>
      ) : null}

      <div className="grid gap-2 border-t border-[var(--brand-border)] pt-3">
        <div className="grid gap-2 border border-[var(--brand-border)] bg-white p-3 text-xs leading-5 sm:grid-cols-4">
          <div>
            <p className="font-mono uppercase tracking-[0.08em] text-[var(--brand-muted-ink)]">saved policy</p>
            <p className="mt-1 font-semibold text-[var(--brand-ink)]">{policyModeLabel(agent.policyMode)}</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-[0.08em] text-[var(--brand-muted-ink)]">per tx</p>
            <p className="mt-1 font-semibold text-[var(--brand-ink)]">{currentPerTxLimit}</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-[0.08em] text-[var(--brand-muted-ink)]">24h limit</p>
            <p className="mt-1 font-semibold text-[var(--brand-ink)]">{currentRollingLimit}</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-[0.08em] text-[var(--brand-muted-ink)]">public withdrawals</p>
            <p className="mt-1 font-semibold text-[var(--brand-ink)]">{agent.publicWithdrawalsEnabled ? "Enabled" : "Off"}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2 border-t border-[var(--brand-border)] pt-3 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <select
          className="h-10 border border-[var(--brand-border)] bg-white px-3 text-sm"
          value={policyMode}
          onChange={(event) => setPolicyMode(event.target.value as LinkedAgent["policyMode"])}
        >
          <option value="approval_required">Approval required</option>
          <option value="autonomous">Autonomous with limits</option>
        </select>
        <Input placeholder="Per tx SOL" value={perTxLimit} onChange={(event) => setPerTxLimit(event.target.value)} />
        <Input placeholder="24h SOL" value={rollingLimit} onChange={(event) => setRollingLimit(event.target.value)} />
        <label className="flex h-10 items-center gap-2 border border-[var(--brand-border)] bg-white px-3 text-xs">
          <input type="checkbox" checked={publicWithdrawals} onChange={(event) => setPublicWithdrawals(event.target.checked)} />
          Public withdrawals
          <span className="group relative inline-flex">
            <span className="inline-flex h-4 w-4 items-center justify-center border border-[#111] bg-[var(--brand-surface)] font-mono text-[10px] font-semibold text-[var(--brand-ink)]">
              i
            </span>
            <span className="pointer-events-none absolute bottom-6 right-0 z-20 hidden w-72 border border-[#111] bg-white p-3 text-left text-xs leading-5 text-[var(--brand-ink)] shadow-neoSm group-hover:block group-focus-within:block">
              Allows the agent to move funds from its private Agent Pay balance to a normal public Solana wallet. This is more visible on-chain and should stay off unless you explicitly want public withdrawals.
            </span>
          </span>
        </label>
        <Button
          variant="secondary"
          disabled={policyPending}
          className="lg:col-start-4"
          onClick={savePolicy}
        >
          {policyPending ? "Saving..." : "Save policy"}
        </Button>
      </div>
      {policyStatus === "saved" ? (
        <p className="border border-[var(--brand-success)] bg-white px-3 py-2 text-sm font-semibold text-[var(--brand-success)] shadow-neoSm" role="status">
          Policy saved.
        </p>
      ) : null}
      {error ? (
        <p className="border border-[#111] bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-neoSm" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function AgentPayablesWorkspace({
  walletAddress,
  initialOverview,
  setupError,
}: {
  walletAddress: string;
  initialOverview: AgentPayOverview;
  setupError?: string | null;
}) {
  const [overview, setOverview] = React.useState(initialOverview);
  const [linkCode, setLinkCode] = React.useState<string | null>(null);
  const [expiresAt, setExpiresAt] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => {
    startTransition(async () => {
      const response = await fetch("/api/agent-pay/overview");
      if (!response.ok) return;
      const body = (await response.json()) as { overview: AgentPayOverview };
      setOverview(body.overview);
    });
  }, []);

  function createCode() {
    startTransition(async () => {
      const response = await fetch("/api/agent-pay/link-codes", { method: "POST" });
      if (!response.ok) return;
      const body = (await response.json()) as { code: string; expiresAt: string };
      setLinkCode(body.code);
      setExpiresAt(body.expiresAt);
    });
  }

  function reviewLink(linkRequestId: string, action: "approve" | "reject", handle: string, displayName: string) {
    startTransition(async () => {
      await fetch("/api/agent-pay/link-requests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ linkRequestId, action, handle, displayName }),
      });
      refresh();
    });
  }

  return (
    <div className="grid w-full gap-4">
      {setupError ? (
        <Panel title="Setup required" right={<Badge tone="amber">database</Badge>}>
          <div className="border border-[#111] bg-[var(--brand-surface)] p-4 shadow-neoSm">
            <p className="text-sm font-semibold text-[var(--brand-ink)]">Agent Pay tables are not installed.</p>
            <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">{setupError}</p>
            <code className="mt-3 block border border-[var(--brand-border)] bg-white px-3 py-2 font-mono text-xs text-[var(--brand-ink)]">
              pnpm db:migrate:agent-pay-overhaul
            </code>
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Link your agent"
        right={<Badge tone={overview.agents.length > 0 ? "green" : "slate"}>{overview.agents.length} linked</Badge>}
      >
        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="text-sm leading-6 text-[var(--brand-muted-ink)]">
              Install the CipherPay skill once. Then tell your agent the code and the handle you want. It creates its own wallet, makes an encrypted backup, and submits the link for approval.
            </p>
            <p className="mt-3 font-mono text-xs text-[var(--brand-muted-ink)]">owner wallet {short(walletAddress)}</p>
            <Button className="mt-4" disabled={pending} onClick={createCode}>
              {linkCode ? "Regenerate code" : "Get linking code"}
            </Button>
            {linkCode ? (
              <div className="mt-4 border border-[#111] bg-[var(--brand-surface)] p-4 shadow-neoSm">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--brand-muted-ink)]">linking code</p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.05em] text-[var(--brand-ink)]">{linkCode}</p>
                <p className="mt-2 text-xs text-[var(--brand-muted-ink)]">Expires {formatDate(expiresAt)}. One use.</p>
              </div>
            ) : null}
          </div>
          <div className="grid gap-3 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--brand-muted-ink)]">1. install skill</p>
              <code className="mt-2 block border border-[#111] bg-white px-3 py-2 font-mono text-xs text-[var(--brand-ink)] shadow-neoSm">
                {AGENT_PAY_SKILL_INSTALL}
              </code>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--brand-muted-ink)]">2. tell your agent</p>
              <div className="mt-2 border border-[#111] bg-white p-3 shadow-neoSm">
                <p className="text-sm font-semibold leading-6 text-[var(--brand-ink)]">{agentInstruction(linkCode)}</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-[var(--brand-muted-ink)]">
                Pick a lowercase handle, 3-32 chars, letters/numbers/hyphens. The agent may ask for one local encryption passphrase. CipherPay never sees it.
              </p>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--brand-muted-ink)]">3. approve here</p>
              <p className="mt-2 text-sm leading-6 text-[var(--brand-muted-ink)]">
                The agent does the setup in chat. You only approve the pending link in CipherPay.
              </p>
            </div>
          </div>
        </div>
      </Panel>

      {overview.pendingLinks.length > 0 ? (
        <Panel title="Pending link requests" right={<Badge tone="amber">{overview.pendingLinks.length} review</Badge>}>
          <div className="grid gap-3">
            {overview.pendingLinks.map((request) => (
              <div key={request.id} className="grid gap-3 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 lg:grid-cols-[1fr_auto]">
                <div>
                  <p className="text-sm font-semibold text-[var(--brand-ink)]">@{request.proposedHandle} / {request.proposedName}</p>
                  <p className="mt-1 font-mono text-xs text-[var(--brand-muted-ink)]">{request.agentWalletAddress}</p>
                  <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">
                    Backup {request.backupAttestedAt ? "attested" : "not attested"} · {formatDate(request.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={pending}
                    onClick={() => reviewLink(request.id, "approve", request.proposedHandle, request.proposedName)}
                  >
                    Approve
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => reviewLink(request.id, "reject", request.proposedHandle, request.proposedName)}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Linked agents">
          {overview.agents.length === 0 ? (
            <div className="border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-5">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">No linked agents.</p>
              <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">Install the skill, generate a code, and tell your agent to link itself.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {overview.agents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} onRefresh={refresh} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Action queue">
          <div className="grid gap-3">
            {overview.fundingRequests.map((item) => (
              <div key={item.id} className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
                <p className="text-sm font-semibold text-[var(--brand-ink)]">@{item.agentHandle} requested funding</p>
                <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">
                  {item.requestedAmountInput ?? "No amount"} SOL · {item.note ?? "No note"}
                </p>
              </div>
            ))}
            {overview.approvals.map((item) => (
              <div key={item.id} className="border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
                <p className="text-sm font-semibold text-[var(--brand-ink)]">@{item.agentHandle} approval</p>
                <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">
                  {item.kind} · expires {formatDate(item.expiresAt)}
                </p>
              </div>
            ))}
            {overview.fundingRequests.length === 0 && overview.approvals.length === 0 ? (
              <p className="border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-sm text-[var(--brand-muted-ink)]">
                No pending funding requests or payment approvals.
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Invoices">
          <div className="grid gap-2">
            {overview.invoices.length === 0 ? (
              <p className="border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-sm text-[var(--brand-muted-ink)]">
                No agent invoices yet.
              </p>
            ) : (
              overview.invoices.map((invoice) => (
                <div key={invoice.id} className="min-w-0 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-semibold text-[var(--brand-ink)]">{invoice.title}</p>
                    <Badge tone={invoice.status === "paid" ? "green" : "blue"}>{invoice.status}</Badge>
                  </div>
                  <p className="mt-1 break-words text-xs text-[var(--brand-muted-ink)]">
                    {invoice.amountInput} {invoice.assetSymbol} · from @{invoice.issuerHandle} · to {invoice.recipientHandle ? `@${invoice.recipientHandle}` : "human link"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Agent history">
          <div className="grid gap-2">
            {overview.activity.length === 0 ? (
              <p className="border border-dashed border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-sm text-[var(--brand-muted-ink)]">
                Agent events will appear here.
              </p>
            ) : (
              overview.activity.map((event) => (
                <div key={event.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2 border border-[var(--brand-border)] bg-[var(--brand-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-[var(--brand-ink)]">
                      {activityTitle(event.eventType, event.status)} {event.agentHandle ? `@${event.agentHandle}` : ""}
                    </p>
                    <p className="mt-1 break-all text-xs leading-5 text-[var(--brand-muted-ink)]">{event.summary ?? event.counterparty ?? "Recorded"}</p>
                  </div>
                  <p className="shrink-0 font-mono text-xs text-[var(--brand-muted-ink)]">{formatDate(event.createdAt)}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
