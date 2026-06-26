import { NextResponse } from "next/server";

import { approveLinkRequest, rejectLinkRequest } from "@/lib/agent-pay/store";
import { requireSession } from "@/lib/auth/server";

type Body = {
  linkRequestId?: string;
  action?: "approve" | "reject";
  handle?: string;
  displayName?: string;
};

export async function POST(request: Request) {
  const session = await requireSession("/agent-pay");
  const body = (await request.json()) as Body;
  if (!body.linkRequestId || !body.action) {
    return NextResponse.json({ error: "linkRequestId and action are required." }, { status: 400 });
  }

  if (body.action === "reject") {
    await rejectLinkRequest(session.userId, body.linkRequestId);
    return NextResponse.json({ ok: true });
  }

  const agentId = await approveLinkRequest({
    userId: session.userId,
    linkRequestId: body.linkRequestId,
    handle: body.handle ?? "",
    displayName: body.displayName ?? body.handle ?? "",
  });
  return NextResponse.json({ ok: true, agentId });
}
