import { NextResponse } from "next/server";

import { listOverview } from "@/lib/agent-pay/store";
import { requireSession } from "@/lib/auth/server";

export async function GET() {
  const session = await requireSession("/agent-pay");
  const overview = await listOverview(session.userId);
  return NextResponse.json({ ok: true, overview });
}
