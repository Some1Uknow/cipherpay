import { PageHeader } from "@/components/layout/PageHeader";
import { PayablesWorkspace } from "@/components/payables/PayablesWorkspace";
import { requireSession } from "@/lib/auth/server";
import { listPayablesForUser } from "@/lib/payables/store";

export default async function PayablesPage() {
  const session = await requireSession("/payables");
  const payables = await listPayablesForUser(session.userId);

  return (
    <>
      <PageHeader
        eyebrow="Payables"
        title="Recurring payout queue"
        description="Save regular recipients, surface what is due, and create a bulk approval draft when it is time to pay."
        badge="Scheduled"
      />
      <PayablesWorkspace payables={payables} />
    </>
  );
}
