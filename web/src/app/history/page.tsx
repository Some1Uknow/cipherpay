import { PayoutHistoryList } from "@/components/history/PayoutHistoryList";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/server";
import { listPayoutRunsForUser } from "@/lib/payout-runs/store";

export default async function HistoryPage() {
  const session = await requireSession("/history");
  const runs = await listPayoutRunsForUser(session.userId, 100);

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Payout history"
        description="Drafts and completed runs."
      />

      <PayoutHistoryList runs={runs} />
    </>
  );
}
