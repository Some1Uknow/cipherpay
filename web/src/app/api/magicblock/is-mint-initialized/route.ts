import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { getMagicBlockMintInitialized } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";

export async function GET() {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await getMagicBlockMintInitialized({
      mint: publicConfig.privatePayoutMint,
      cluster: publicConfig.magicblockCluster,
      validator: publicConfig.magicblockValidator,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not check mint initialization." }, { status: 502 });
  }
}
