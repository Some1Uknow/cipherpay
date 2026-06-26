import { NextResponse } from "next/server";

import { createAgentLinkRequest } from "@/lib/agent-pay/store";

type Body = {
  code?: string;
  proposedHandle?: string;
  proposedName?: string;
  agentWalletAddress?: string;
  agentViewingPublicKey?: string;
  encryptedViewingKey?: string;
  backupAttested?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Body;
  if (!body.code || !body.proposedHandle || !body.agentWalletAddress) {
    return NextResponse.json({ error: "code, proposedHandle, and agentWalletAddress are required." }, { status: 400 });
  }

  try {
    const result = await createAgentLinkRequest({
      code: body.code,
      proposedHandle: body.proposedHandle,
      proposedName: body.proposedName ?? body.proposedHandle,
      agentWalletAddress: body.agentWalletAddress,
      agentViewingPublicKey: body.agentViewingPublicKey,
      encryptedViewingKey: body.encryptedViewingKey,
      backupAttested: body.backupAttested === true,
    });
    return NextResponse.json({
      ok: true,
      ...result,
      tokenActivation: "after_owner_approval",
      nextAction: "Wait for the owner to confirm the pending link in CipherPay. The token is not active until approval.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create link request." }, { status: 400 });
  }
}
