import { NextResponse } from "next/server";

import { getAuthenticatedSession } from "@/lib/auth/server";
import { loginMagicBlock } from "@/lib/magicblock/api";
import { publicConfig } from "@/lib/public-config";

type LoginBody = {
  challenge?: string;
  signature?: string;
};

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: LoginBody;
  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.challenge || !body.signature) {
    return NextResponse.json({ error: "challenge and signature are required." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await loginMagicBlock({
        pubkey: session.walletAddress,
        challenge: body.challenge,
        signature: body.signature,
        cluster: publicConfig.magicblockCluster,
      }),
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "MagicBlock login failed." }, { status: 502 });
  }
}
