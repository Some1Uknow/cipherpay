import { NextResponse } from "next/server";

import { getMagicBlockHealth } from "@/lib/magicblock/api";

export async function GET() {
  try {
    return NextResponse.json(await getMagicBlockHealth());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MagicBlock health check failed." }, { status: 502 });
  }
}
