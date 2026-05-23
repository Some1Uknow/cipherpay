import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { updatePayoutRunExecution } from "@/lib/payout-runs/store";
import type { PayoutRunStatus } from "@/lib/payout-runs/types";

type UpdateRunStatusBody = {
  status?: PayoutRunStatus;
  rows?: Array<{
    id?: string;
    rowStatus?: "draft" | "ready" | "submitted" | "confirmed" | "failed";
    txSignature?: string | null;
    errorMessage?: string | null;
  }>;
};

export async function PATCH(request: Request, context: { params: Promise<{ runId: string }> }) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { runId } = await context.params;
  let body: UpdateRunStatusBody;

  try {
    body = (await request.json()) as UpdateRunStatusBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: "status is required." }, { status: 400 });
  }

  const run = await updatePayoutRunExecution({
    runId,
    userId: session.userId,
    status: body.status,
    rows: Array.isArray(body.rows)
      ? body.rows
          .filter((row): row is { id: string; rowStatus: "draft" | "ready" | "submitted" | "confirmed" | "failed"; txSignature?: string | null; errorMessage?: string | null } => Boolean(row.id && row.rowStatus))
      : [],
  });

  return NextResponse.json({ run });
}
