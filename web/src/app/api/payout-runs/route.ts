import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { upsertDraftPayoutRun } from "@/lib/payout-runs/store";
import type { PayoutRowDraft, PayoutRunEntryMode } from "@/lib/payout-runs/types";

type UpsertPayoutRunBody = {
  runId?: string | null;
  entryMode?: PayoutRunEntryMode;
  rows?: Array<{
    id?: string;
    recipientName?: string;
    walletAddress?: string;
    amount?: string;
  }>;
};

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: UpsertPayoutRunBody;

  try {
    body = (await request.json()) as UpsertPayoutRunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.entryMode || (body.entryMode !== "manual" && body.entryMode !== "csv")) {
    return NextResponse.json({ error: "entryMode must be manual or csv." }, { status: 400 });
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "rows must be an array." }, { status: 400 });
  }

  const rows: PayoutRowDraft[] = body.rows.map((row) => ({
    id: row.id ?? crypto.randomUUID(),
    recipientName: typeof row.recipientName === "string" ? row.recipientName : "",
    walletAddress: typeof row.walletAddress === "string" ? row.walletAddress : "",
    amount: typeof row.amount === "string" ? row.amount : "",
  }));

  const run = await upsertDraftPayoutRun({
    userId: session.userId,
    walletAddress: session.walletAddress,
    entryMode: body.entryMode,
    rows,
    runId: body.runId,
  });

  return NextResponse.json({ run });
}
