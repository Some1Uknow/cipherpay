import { EmptyStateCard } from "@/components/layout/EmptyStateCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/server";

const exampleRuns = [
  { name: "Friday contractor payouts", date: "May 23", count: "12 rows", total: "8,640.00 USDC", status: "Completed" },
  { name: "Design retainer cycle", date: "May 20", count: "4 rows", total: "3,200.00 USDC", status: "Partial failure" },
] as const;

export default async function HistoryPage() {
  await requireSession("/history");

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Recent payout runs"
        description="History should answer what happened without forcing the user back through operational screens."
      />

      <div className="grid gap-4">
        {exampleRuns.map((run) => (
          <Card key={`${run.name}-${run.date}`}>
            <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold tracking-[-0.02em] text-[var(--brand-ink)]">{run.name}</p>
                <p className="mt-1 text-sm text-[var(--brand-muted-ink)]">{run.date} • {run.count}</p>
              </div>
              <div className="flex flex-col gap-1 text-left sm:items-end">
                <p className="text-sm font-medium text-[var(--brand-ink)]">{run.total}</p>
                <p className="text-sm text-[var(--brand-muted-ink)]">{run.status}</p>
              </div>
            </CardContent>
          </Card>
        ))}

        <EmptyStateCard
          title="No persisted runs yet"
          description="Once payout runs are stored in Postgres and synced with execution results, they should appear here automatically."
          actionLabel="Start a payout run"
          actionHref="/pay"
        />
      </div>
    </>
  );
}
