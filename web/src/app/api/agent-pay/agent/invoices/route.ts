import { NextResponse } from "next/server";

import { requireAgent, verifyAgentSignature } from "@/app/api/agent-pay/_agent-auth";
import { createInvoice } from "@/lib/agent-pay/store";

type Body = {
  recipientHandle?: string;
  amountSol?: string;
  title?: string;
  description?: string;
  dueAt?: string;
  externalRef?: string;
  humanContact?: string;
  signature?: string;
  signedMessage?: string;
};

export async function POST(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;
  const body = (await request.json()) as Body;
  if (!body.amountSol || !body.title) {
    return NextResponse.json({ error: "amountSol and title are required." }, { status: 400 });
  }
  if (!verifyAgentSignature({
    agentWalletAddress: agent.agent_wallet_address,
    signature: body.signature,
    signedMessage: body.signedMessage,
    expectedAction: "create_invoice",
  })) {
    return NextResponse.json({ error: "Fresh agent wallet signature is required." }, { status: 401 });
  }

  const invoice = await createInvoice({
    issuerAgentId: agent.agent_id,
    issuerUserId: agent.user_id,
    recipientHandle: body.recipientHandle,
    amountInput: body.amountSol,
    title: body.title,
    description: body.description,
    dueAt: body.dueAt,
    externalRef: body.externalRef,
    humanContact: body.humanContact,
  });
  return NextResponse.json({ ok: true, invoice });
}
