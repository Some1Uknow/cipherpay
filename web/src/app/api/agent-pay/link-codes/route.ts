import { NextResponse } from "next/server";

import { createOwnerLinkCode } from "@/lib/agent-pay/store";
import { requireSession } from "@/lib/auth/server";

export async function POST() {
  const session = await requireSession("/agent-pay");
  const linkCode = await createOwnerLinkCode(session.userId, session.walletAddress);
  return NextResponse.json({ ok: true, ...linkCode });
}
