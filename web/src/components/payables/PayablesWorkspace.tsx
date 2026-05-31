"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PayableCadence, PayableRecord } from "@/lib/payables/types";
import { cn } from "@/lib/utils";

type PayablesWorkspaceProps = {
  payables: PayableRecord[];
};

const cadenceOptions: Array<{ value: PayableCadence; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "one_time", label: "One-time" },
];

function todayDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function cadenceLabel(value: PayableCadence) {
  return cadenceOptions.find((option) => option.value === value)?.label ?? value;
}

function isDue(payable: PayableRecord) {
  return payable.active && payable.nextDueOn <= todayDateInput();
}

export function PayablesWorkspace({ payables }: PayablesWorkspaceProps) {
  const router = useRouter();
  const duePayables = React.useMemo(() => payables.filter(isDue), [payables]);
  const upcomingPayables = React.useMemo(() => payables.filter((payable) => payable.active && !isDue(payable)), [payables]);
  const inactivePayables = React.useMemo(() => payables.filter((payable) => !payable.active), [payables]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set(duePayables.map((payable) => payable.id)));
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [creatingPayable, setCreatingPayable] = React.useState(false);
  const [creatingDraft, setCreatingDraft] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  React.useEffect(() => {
    setSelectedIds(new Set(duePayables.map((payable) => payable.id)));
  }, [duePayables]);

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleCreatePayable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateError(null);
    setCreatingPayable(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      recipientName: String(formData.get("recipientName") ?? ""),
      walletAddress: String(formData.get("walletAddress") ?? ""),
      amount: String(formData.get("amount") ?? ""),
      cadence: String(formData.get("cadence") ?? "monthly"),
      nextDueOn: String(formData.get("nextDueOn") ?? ""),
      memo: String(formData.get("memo") ?? ""),
    };

    try {
      const response = await fetch("/api/payables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Could not save payable.");
      }
      formRef.current?.reset();
      router.refresh();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not save payable.");
    } finally {
      setCreatingPayable(false);
    }
  }

  async function handleCreateDraft() {
    setDraftError(null);
    setCreatingDraft(true);

    try {
      const response = await fetch("/api/payables/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payableIds: Array.from(selectedIds) }),
      });
      const body = (await response.json()) as { approvalUrl?: string; error?: string };
      if (!response.ok || !body.approvalUrl) {
        throw new Error(body.error ?? "Could not create payable draft.");
      }
      router.push(body.approvalUrl);
    } catch (error) {
      setDraftError(error instanceof Error ? error.message : "Could not create payable draft.");
    } finally {
      setCreatingDraft(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
      <section className="rounded-[28px] bg-white/80 p-5 shadow-neoInsetSm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Due payables</h2>
            <p className="mt-1 text-sm leading-6 text-[var(--brand-muted-ink)]">
              Select recurring payouts and turn them into one bulk approval draft.
            </p>
          </div>
          <Badge tone={duePayables.length > 0 ? "blue" : "slate"}>{duePayables.length} due</Badge>
        </div>

        <div className="mt-5 grid gap-3">
          {duePayables.length === 0 ? (
            <div className="rounded-2xl bg-white px-4 py-5 shadow-neoInsetSm">
              <p className="text-sm font-semibold text-[var(--brand-ink)]">Nothing due today</p>
              <p className="mt-1 text-sm leading-6 text-[var(--brand-muted-ink)]">
                Add a payable or wait for the next scheduled payout date.
              </p>
            </div>
          ) : (
            duePayables.map((payable) => (
              <label
                key={payable.id}
                className={cn(
                  "flex cursor-pointer flex-col gap-3 rounded-2xl bg-white p-4 shadow-neoSm transition hover:-translate-y-0.5 hover:shadow-neo",
                  selectedIds.has(payable.id) ? "ring-2 ring-[var(--brand-primary)] ring-offset-2 ring-offset-white" : "",
                )}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-[rgba(15,23,42,0.18)] accent-[var(--brand-primary)]"
                    checked={selectedIds.has(payable.id)}
                    onChange={() => toggleSelected(payable.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--brand-ink)]">{payable.recipientName}</p>
                      <Badge tone="amber">Due {formatDate(payable.nextDueOn)}</Badge>
                    </div>
                    <p className="mt-1 break-all font-mono text-xs text-[var(--brand-muted-ink)]">{payable.walletAddress}</p>
                    {payable.memo ? <p className="mt-2 text-sm text-[var(--brand-muted-ink)]">{payable.memo}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[var(--brand-ink)]">{payable.amount}</p>
                    <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">{cadenceLabel(payable.cadence)}</p>
                  </div>
                </div>
              </label>
            ))
          )}
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-white px-4 py-4 shadow-neoInsetSm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-ink)]">{selectedIds.size} selected</p>
            <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">Creates a bulk draft for wallet approval.</p>
            {draftError ? <p className="mt-1 text-xs text-red-700">{draftError}</p> : null}
          </div>
          <Button onClick={handleCreateDraft} disabled={selectedIds.size === 0 || creatingDraft}>
            {creatingDraft ? "Creating..." : "Create draft"}
          </Button>
        </div>

        {upcomingPayables.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">Upcoming</h3>
            <div className="mt-3 grid gap-2">
              {upcomingPayables.map((payable) => (
                <div key={payable.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-neoInsetSm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--brand-ink)]">{payable.recipientName}</p>
                    <p className="mt-1 text-xs text-[var(--brand-muted-ink)]">Due {formatDate(payable.nextDueOn)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[var(--brand-ink)]">{payable.amount}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {inactivePayables.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--brand-ink)]">Completed one-time payables</h3>
            <p className="mt-2 text-sm text-[var(--brand-muted-ink)]">{inactivePayables.length} completed.</p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[28px] bg-white/80 p-5 shadow-neoInsetSm sm:p-6">
        <h2 className="text-sm font-semibold text-[var(--brand-ink)]">Add payable</h2>
        <form ref={formRef} className="mt-5 grid gap-4" onSubmit={handleCreatePayable}>
          <div className="grid gap-1.5">
            <Label htmlFor="recipientName">Recipient</Label>
            <Input id="recipientName" name="recipientName" autoComplete="name" placeholder="Northline Studio" required />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="walletAddress">Wallet address</Label>
            <Input id="walletAddress" name="walletAddress" spellCheck={false} placeholder="Solana recipient wallet" required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" inputMode="decimal" placeholder="0.25" required />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="nextDueOn">Next due</Label>
              <Input id="nextDueOn" name="nextDueOn" type="date" defaultValue={todayDateInput()} required />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cadence">Cadence</Label>
            <select
              id="cadence"
              name="cadence"
              defaultValue="monthly"
              className="h-11 w-full rounded-2xl bg-[var(--brand-surface)] px-4 text-sm text-[var(--brand-ink)] shadow-neoInsetSm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--brand-surface)]"
            >
              {cadenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="memo">Memo</Label>
            <Textarea id="memo" name="memo" placeholder="Monthly retainer, invoice note, or internal reason" />
          </div>

          {createError ? <p className="text-sm text-red-700">{createError}</p> : null}

          <Button type="submit" disabled={creatingPayable}>
            {creatingPayable ? "Saving..." : "Save payable"}
          </Button>
        </form>
      </section>
    </div>
  );
}
