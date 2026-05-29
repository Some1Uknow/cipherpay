import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";
import { getLatestOpenPayoutRunForUser } from "@/lib/payout-runs/store";

export default async function PayPage() {
  const session = await requireSession("/pay");
  const initialRun = await getLatestOpenPayoutRunForUser(session.userId, "manual");

  return (
    <>
      <PageHeader
        eyebrow="Pay"
        title="Send one payout"
        description="A simple single-recipient flow for quick private payments."
        badge="Manual"
      />
      <PayoutRunWorkspace walletAddress={session.walletAddress} initialRun={initialRun} entryMode="manual" />
    </>
  );
}
