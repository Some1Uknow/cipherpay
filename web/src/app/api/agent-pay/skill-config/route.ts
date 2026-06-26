import { NextResponse } from "next/server";

import {
  AGENT_PAY_API_VERSION,
  AGENT_PAY_LOCAL_STATE_DIR,
  AGENT_PAY_SKILL_INSTALL,
  AGENT_PAY_SKILL_NAME,
  agentSignedMessageTemplates,
} from "@/lib/agent-pay/protocol";
import { publicConfig } from "@/lib/public-config";

export async function GET() {
  return NextResponse.json({
    ok: true,
    skill: {
      name: AGENT_PAY_SKILL_NAME,
      install: AGENT_PAY_SKILL_INSTALL,
      localStateDir: AGENT_PAY_LOCAL_STATE_DIR,
    },
    api: {
      version: AGENT_PAY_API_VERSION,
      baseUrl: publicConfig.appUrl.replace(/\/$/, ""),
      asset: {
        symbol: "SOL",
        decimals: 9,
        minimumFundingAmount: "0.01",
      },
      endpoints: {
        createLinkRequest: "/api/agent-pay/agent/link-requests",
        session: "/api/agent-pay/agent/session",
        policy: "/api/agent-pay/agent/session",
        requestFunding: "/api/agent-pay/agent/funding-requests",
        createInvoice: "/api/agent-pay/agent/invoices",
        resolveHandle: "/api/agent-pay/public/handles/{handle}",
        publicInvoice: "/api/agent-pay/public/invoices/{slug}",
      },
      signedMessages: agentSignedMessageTemplates,
      sensitiveCalls: ["requestFunding", "createInvoice"],
    },
  });
}
