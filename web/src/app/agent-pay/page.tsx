import { AgentPayablesWorkspace } from "@/components/agent/AgentPayablesWorkspace";
import { PageHeader } from "@/components/layout/PageHeader";
import { isAgentPaySchemaMissingError, listOverview } from "@/lib/agent-pay/store";
import { requireSession } from "@/lib/auth/server";

export default async function AgentPayPage() {
  const session = await requireSession("/agent-pay");
  let overview;
  let setupError: string | null = null;
  try {
    overview = await listOverview(session.userId);
  } catch (error) {
    if (!isAgentPaySchemaMissingError(error)) throw error;
    setupError = error.message;
    overview = {
      agents: [],
      pendingLinks: [],
      fundingRequests: [],
      approvals: [],
      invoices: [],
      activity: [],
    };
  }

  return (
    <>
      <PageHeader
        eyebrow="Agent pay"
        title="Link agents. Fund privately. Approve precisely."
        description="Agents get their own wallet and shielded balance. Your official wallet links them, funds them, and reviews anything outside policy."
        badge="Agent wallet"
      />
      <AgentPayablesWorkspace walletAddress={session.walletAddress} initialOverview={overview} setupError={setupError} />
    </>
  );
}
