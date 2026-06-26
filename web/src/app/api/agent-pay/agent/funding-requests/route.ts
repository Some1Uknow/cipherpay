import { NextResponse } from "next/server";

import { requireAgent, verifyAgentSignature } from "@/app/api/agent-pay/_agent-auth";
import { createFundingRequest } from "@/lib/agent-pay/store";

type Body = {
  amountSol?: string;
  note?: string;
  signature?: string;
  signedMessage?: string;
};

export async function POST(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;
  const body = (await request.json()) as Body;
  if (!verifyAgentSignature({
    agentWalletAddress: agent.agent_wallet_address,
    signature: body.signature,
    signedMessage: body.signedMessage,
    expectedAction: "request_funding",
  })) {
    return NextResponse.json({ error: "Fresh agent wallet signature is required." }, { status: 401 });
  }
  await createFundingRequest({
    agentId: agent.agent_id,
    userId: agent.user_id,
    amountInput: body.amountSol,
    note: body.note,
  });
  return NextResponse.json({ ok: true, status: "pending_owner_review" });
}
