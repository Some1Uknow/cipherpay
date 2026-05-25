import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { getMagicBlockChallenge } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    return NextResponse.json(
      await getMagicBlockChallenge({
        pubkey: session.walletAddress,
        cluster: publicConfig.magicblockCluster,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create MagicBlock challenge." }, { status: 502 });
  }
}
