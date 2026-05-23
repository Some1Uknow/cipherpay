import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";

export default async function PayPage() {
  const session = await requireSession("/pay");

  return (
    <>
      <PageHeader
        eyebrow="Pay"
        title="Build a payout run"
        description="Keep entry, review, and send state in one place. The product should feel like one calm decision surface, not a maze of setup."
        badge="Phase 1 core"
      />
      <PayoutRunWorkspace walletAddress={session.walletAddress} />
    </>
  );
}
