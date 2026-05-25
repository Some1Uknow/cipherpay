import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { buildMagicBlockPrivateTransfer } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";
import { getPayoutRunForUser } from "@/lib/payout-runs/store";
import { getServerConfig } from "@/lib/server-config";

type TransferBody = {
  runId?: string;
  rowId?: string;
  token?: string;
};

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: TransferBody;
  try {
    body = (await request.json()) as TransferBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.runId || !body.rowId) {
    return NextResponse.json({ error: "runId and rowId are required." }, { status: 400 });
  }

  const run = await getPayoutRunForUser({ runId: body.runId, userId: session.userId });
  if (!run) {
    return NextResponse.json({ error: "Payout run not found." }, { status: 404 });
  }
  if (run.walletAddress !== session.walletAddress) {
    return NextResponse.json({ error: "Connected session wallet does not own this payout run." }, { status: 403 });
  }
  if (run.assetMint !== publicConfig.privatePayoutMint) {
    return NextResponse.json({ error: "Payout run asset does not match configured private payout mint." }, { status: 400 });
  }

  const row = run.rows.find((candidate) => candidate.id === body.rowId);
  if (!row) {
    return NextResponse.json({ error: "Payout row not found." }, { status: 404 });
  }
  if (!row.amountBaseUnits || BigInt(row.amountBaseUnits) <= BigInt(0)) {
    return NextResponse.json({ error: "Payout row does not have a valid base-unit amount." }, { status: 400 });
  }

  const config = getServerConfig();
  const split = Math.min(Math.max(row.privateTransferSplit ?? 1, 1), config.privatePayoutMaxSplit);
  if (split !== 1) {
    return NextResponse.json({ error: "Private transfer split values above 1 are disabled for this release." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await buildMagicBlockPrivateTransfer({
        from: session.walletAddress,
        to: row.walletAddress,
        mint: publicConfig.privatePayoutMint,
        amount: row.amountBaseUnits,
        cluster: publicConfig.magicblockCluster,
        validator: publicConfig.magicblockValidator,
        split,
        minDelayMs: row.privateTransferMinDelayMs ?? config.privatePayoutDefaultMinDelayMs,
        maxDelayMs: row.privateTransferMaxDelayMs ?? config.privatePayoutDefaultMaxDelayMs,
        clientRefId: row.clientRefId && /^\d+$/.test(row.clientRefId) ? row.clientRefId : Date.now().toString(),
        token: body.token,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not build MagicBlock private transfer." }, { status: 502 });
  }
}
