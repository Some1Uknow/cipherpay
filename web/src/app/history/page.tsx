import { EmptyStateCard } from "@/components/layout/EmptyStateCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/server";
import { listPayoutRunsForUser } from "@/lib/payout-runs/store";

export default async function HistoryPage() {
  const session = await requireSession("/history");
  const runs = await listPayoutRunsForUser(session.userId, 20);

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Payout history"
        description="See what was sent, what failed, and what needs another look without reopening the working surface."
      />

      <div className="grid gap-4">
        {runs.map((run) => (
          <Card key={run.id}>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">
                  {run.status === "ready" ? "Ready payout run" : "Draft payout run"}
                </p>
                <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(run.lastInteractedAt))}{" "}
                  • {run.itemCount} rows
                </p>
              </div>
              <div className="flex flex-col gap-2 text-left sm:items-end">
                <p className="text-sm font-medium text-[var(--brand-ink)]">{run.totalAmount} USDC</p>
                <Badge tone={run.status === "ready" ? "green" : "slate"}>{run.status}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}

        {runs.length === 0 ? (
          <EmptyStateCard
            title="No payout runs yet"
            description="As soon as you start entering rows in the payout workspace, CipherPay will save the draft and surface it here."
            actionLabel="Start a payout run"
            actionHref="/pay"
          />
        ) : null}
      </div>
    </>
  );
}
