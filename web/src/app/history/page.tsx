import { PayoutHistoryList } from "@/components/history/PayoutHistoryList";
import { PageHeader } from "@/components/layout/PageHeader";
import { isAgentPaySchemaMissingError, listOverview } from "@/lib/agent-pay/store";
import { requireSession } from "@/lib/auth/server";
import { listPayoutRunsForUser } from "@/lib/payout-runs/store";

export default async function HistoryPage() {
  const session = await requireSession("/history");
  const [runs, overview] = await Promise.all([
    listPayoutRunsForUser(session.userId, 100),
    listOverview(session.userId).catch((error) => {
      if (isAgentPaySchemaMissingError(error)) {
        return {
          agents: [],
          pendingLinks: [],
          fundingRequests: [],
          approvals: [],
          invoices: [],
          activity: [],
        };
      }
      throw error;
    }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="History"
        title="Payment history"
        description="Manual runs, bulk runs, and agent payment events."
      />

      <PayoutHistoryList runs={runs} agentActivity={overview.activity} />
    </>
  );
}
