import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";
import { getLatestOpenPayoutRunForUser } from "@/lib/payout-runs/store";

export default async function BulkPayPage() {
  const session = await requireSession("/bulk-pay");
  const initialRun = await getLatestOpenPayoutRunForUser(session.userId, "csv");

  return (
    <>
      <PageHeader
        eyebrow="Bulk pay"
        title="Send a payout batch"
        description="Paste a CSV, review the rows, and send one clean batch."
        badge="CSV"
      />
      <PayoutRunWorkspace walletAddress={session.walletAddress} initialRun={initialRun} entryMode="csv" />
    </>
  );
}
