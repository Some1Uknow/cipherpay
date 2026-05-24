import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";

export async function GET() {
  const session = await getAuthenticatedSession();

  if (!session) {
    return NextResponse.json({ session: null });
  }

  return NextResponse.json({
    session: {
      userId: session.userId,
      walletAddress: session.walletAddress,
      expiresAt: session.expiresAt,
    },
  });
}
