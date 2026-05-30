import { AgentPayablesWorkspace } from "@/components/agent/AgentPayablesWorkspace";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireSession } from "@/lib/auth/server";
import { listMcpDraftPayoutRunsForUser } from "@/lib/payout-runs/store";

export default async function AgentPayPage() {
  const session = await requireSession("/agent-pay");
  const drafts = await listMcpDraftPayoutRunsForUser(session.userId, 8);

  return (
    <>
      <PageHeader
        eyebrow="Agent pay"
        title="MCP payment drafts"
        description="Connect CipherPay to an AI client so it can create payout drafts that you approve with your wallet."
        badge="MCP"
      />
      <AgentPayablesWorkspace walletAddress={session.walletAddress} drafts={drafts} />
    </>
  );
}
