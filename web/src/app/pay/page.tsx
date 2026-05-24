import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";
import { getLatestOpenPayoutRunForUser } from "@/lib/payout-runs/store";

export default async function PayPage() {
  const session = await requireSession("/pay");
  const initialRun = await getLatestOpenPayoutRunForUser(session.userId);

  return (
    <>
      <PageHeader
        eyebrow="Pay"
        title="Prepare payouts"
        description="Draft rows, review totals, and export a clean run."
        badge="Workspace"
      />
      <PayoutRunWorkspace walletAddress={session.walletAddress} initialRun={initialRun} />
    </>
  );
}
