import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { getMagicBlockPrivateBalance } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";
  if (!token) {
    return NextResponse.json({ error: "MagicBlock bearer token is required." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await getMagicBlockPrivateBalance({
        address: session.walletAddress,
        mint: publicConfig.privatePayoutMint,
        cluster: publicConfig.magicblockCluster,
        token,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not read private balance." }, { status: 502 });
  }
}
