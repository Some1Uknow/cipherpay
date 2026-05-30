import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";
import { getLatestOpenPayoutRunForUser, getPayoutRunForUser } from "@/lib/payout-runs/store";

type PayPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PayPage({ searchParams }: PayPageProps) {
  const session = await requireSession("/pay");
  const resolvedSearchParams = await searchParams;
  const runId = firstSearchParam(resolvedSearchParams?.runId);
  const initialRun = runId
    ? await getPayoutRunForUser({ userId: session.userId, runId, entryMode: "manual" })
    : await getLatestOpenPayoutRunForUser(session.userId, "manual");

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
