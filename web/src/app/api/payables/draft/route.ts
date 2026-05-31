import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { createDraftFromPayables } from "@/lib/payables/store";

type CreatePayablesDraftBody = {
  payableIds?: string[];
};

function approvalUrl(runId: string) {
  const url = new URL("/bulk-pay", "http://cipherpay.local");
  url.searchParams.set("runId", runId);
  return `${url.pathname}${url.search}`;
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CreatePayablesDraftBody;
  try {
    body = (await request.json()) as CreatePayablesDraftBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const run = await createDraftFromPayables({
      userId: session.userId,
      walletAddress: session.walletAddress,
      payableIds: Array.isArray(body.payableIds) ? body.payableIds : [],
    });

    return NextResponse.json({
      run,
      approvalUrl: approvalUrl(run.id),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create payable draft." },
      { status: 400 },
    );
  }
}
