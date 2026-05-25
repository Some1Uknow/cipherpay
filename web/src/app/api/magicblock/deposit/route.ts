import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { buildMagicBlockDeposit } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";
import { getPayoutRunForUser } from "@/lib/payout-runs/store";

type DepositBody = {
  runId?: string;
  amount?: string;
};

function parsePositiveBaseUnits(value: unknown) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("amount must be a positive integer base-unit string.");
  }
  const parsed = BigInt(value);
  if (parsed <= BigInt(0)) {
    throw new Error("amount must be greater than zero.");
  }
  return parsed;
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: DepositBody;
  try {
    body = (await request.json()) as DepositBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.runId) {
    return NextResponse.json({ error: "runId is required." }, { status: 400 });
  }

  let amount: bigint;
  try {
    amount = parsePositiveBaseUnits(body.amount);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid amount." }, { status: 400 });
  }

  const run = await getPayoutRunForUser({ runId: body.runId, userId: session.userId });
  if (!run) {
    return NextResponse.json({ error: "Payout run not found." }, { status: 404 });
  }
  if (run.walletAddress !== session.walletAddress) {
    return NextResponse.json({ error: "Connected session wallet does not own this payout run." }, { status: 403 });
  }
  const maxDeposit = BigInt(run.totalBaseUnits ?? "0");
  if (amount > maxDeposit) {
    return NextResponse.json({ error: "Deposit amount exceeds this run's required total." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await buildMagicBlockDeposit({
        owner: session.walletAddress,
        amount: amount.toString(),
        mint: publicConfig.privatePayoutMint,
        cluster: publicConfig.magicblockCluster,
        validator: publicConfig.magicblockValidator,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build MagicBlock deposit." }, { status: 502 });
  }
}
