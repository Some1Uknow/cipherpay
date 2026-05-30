import { PageHeader } from "@/components/layout/PageHeader";
import { PayoutRunWorkspace } from "@/components/pay/PayoutRunWorkspace";
import { requireSession } from "@/lib/auth/server";
import { getLatestOpenPayoutRunForUser, getPayoutRunForUser } from "@/lib/payout-runs/store";

type BulkPayPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function BulkPayPage({ searchParams }: BulkPayPageProps) {
  const session = await requireSession("/bulk-pay");
  const resolvedSearchParams = await searchParams;
  const runId = firstSearchParam(resolvedSearchParams?.runId);
  const initialRun = runId
    ? await getPayoutRunForUser({ userId: session.userId, runId, entryMode: "csv" })
    : await getLatestOpenPayoutRunForUser(session.userId, "csv");

  return (
    <>
      <PageHeader
        eyebrow="Bulk pay"
        title="Run private payroll"
        description="Paste a roster, validate every row, then fund one Cloak batch and stream private payouts recipient by recipient."
        badge="CSV"
      />
      <PayoutRunWorkspace walletAddress={session.walletAddress} initialRun={initialRun} entryMode="csv" />
    </>
  );
}
