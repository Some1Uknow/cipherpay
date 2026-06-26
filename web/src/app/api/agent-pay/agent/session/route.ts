import { NextResponse } from "next/server";

import { requireAgent } from "@/app/api/agent-pay/_agent-auth";

export async function GET(request: Request) {
  const { agent, error } = await requireAgent(request);
  if (error) return error;
  return NextResponse.json({ ok: true, agent });
}
