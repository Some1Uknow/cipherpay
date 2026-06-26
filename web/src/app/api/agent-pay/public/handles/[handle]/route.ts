import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const db = getDb();
  const result = await db.query<{
    handle: string;
    display_name: string;
    agent_wallet_address: string;
    agent_viewing_public_key: string | null;
    asset_symbol: string;
  }>(
    `
      select handle, display_name, agent_wallet_address, agent_viewing_public_key, asset_symbol
      from agents
      where handle = $1 and status = 'active'
      limit 1
    `,
    [handle.toLowerCase()],
  );
  const agent = result.rows[0];
  if (!agent) return NextResponse.json({ error: "Agent handle not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    agent: {
      handle: agent.handle,
      displayName: agent.display_name,
      agentWalletAddress: agent.agent_wallet_address,
      agentViewingPublicKey: agent.agent_viewing_public_key,
      assetSymbol: agent.asset_symbol,
    },
  });
}
