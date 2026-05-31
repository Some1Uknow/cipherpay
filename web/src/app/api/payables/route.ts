import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { createPayableForUser } from "@/lib/payables/store";
import type { PayableCadence } from "@/lib/payables/types";

type CreatePayableBody = {
  recipientName?: string;
  walletAddress?: string;
  amount?: string;
  cadence?: PayableCadence;
  nextDueOn?: string;
  memo?: string;
};

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: CreatePayableBody;
  try {
    body = (await request.json()) as CreatePayableBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const payable = await createPayableForUser({
      userId: session.userId,
      recipientName: body.recipientName ?? "",
      walletAddress: body.walletAddress ?? "",
      amount: body.amount ?? "",
      cadence: body.cadence ?? "monthly",
      nextDueOn: body.nextDueOn ?? "",
      memo: body.memo,
    });

    return NextResponse.json({ payable });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create payable." },
      { status: 400 },
    );
  }
}
