import { NextResponse } from "next/server";

import { recordConfirmedAgentFunding, updateAgentPolicy } from "@/lib/agent-pay/store";
import { optionalSolInputToBaseUnits } from "@/lib/agent-pay/amounts";
import { requireSession } from "@/lib/auth/server";

type Body =
  | {
      action: "policy";
      agentId?: string;
      policyMode?: "approval_required" | "autonomous";
      perTxLimitSol?: string;
      rolling24hLimitSol?: string;
      publicWithdrawalsEnabled?: boolean;
    }
  | {
      action: "fund";
      agentId?: string;
      amountSol?: string;
      depositSignature?: string;
      depositCommitment?: string | null;
      serializedUtxo?: string;
    };

export async function POST(request: Request) {
  const session = await requireSession("/agent-pay");
  const body = (await request.json()) as Body;

  if (!body.agentId) {
    return NextResponse.json({ error: "agentId is required." }, { status: 400 });
  }

  if (body.action === "fund") {
    if (!body.amountSol) return NextResponse.json({ error: "amountSol is required." }, { status: 400 });
    if (!body.depositSignature) return NextResponse.json({ error: "depositSignature is required." }, { status: 400 });
    if (!body.serializedUtxo) return NextResponse.json({ error: "serializedUtxo is required." }, { status: 400 });
    try {
      await recordConfirmedAgentFunding({
        userId: session.userId,
        agentId: body.agentId,
        amountInput: body.amountSol,
        depositSignature: body.depositSignature,
        depositCommitment: body.depositCommitment,
        serializedUtxo: body.serializedUtxo,
      });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Could not record agent funding." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  let perTxLimitBaseUnits: string | null;
  let rolling24hLimitBaseUnits: string | null;
  try {
    perTxLimitBaseUnits = optionalSolInputToBaseUnits(body.perTxLimitSol);
    rolling24hLimitBaseUnits = optionalSolInputToBaseUnits(body.rolling24hLimitSol);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid policy limit." }, { status: 400 });
  }

  const policyMode = body.policyMode ?? "approval_required";
  if (policyMode === "autonomous" && (!perTxLimitBaseUnits || !rolling24hLimitBaseUnits)) {
    return NextResponse.json(
      { error: "Autonomous mode requires both a per-transaction limit and a rolling 24h limit." },
      { status: 400 },
    );
  }

  await updateAgentPolicy({
    userId: session.userId,
    agentId: body.agentId,
    policyMode,
    perTxLimitBaseUnits,
    rolling24hLimitBaseUnits,
    publicWithdrawalsEnabled: body.publicWithdrawalsEnabled ?? false,
  });
  return NextResponse.json({ ok: true });
}
