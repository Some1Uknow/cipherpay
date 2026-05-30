import { NextResponse } from "next/server";

import { findUserByWalletAddress } from "@/lib/auth/store";
import { normalizeWalletAddress } from "@/lib/auth/request";
import { getPrivatePayoutAsset } from "@/lib/cloak/config";
import { upsertDraftPayoutRun } from "@/lib/payout-runs/store";
import type { PayoutRowDraft, PayoutRowIssue, PayoutRunEntryMode } from "@/lib/payout-runs/types";
import { validateRows } from "@/lib/payout-runs/validation";
import { getServerConfig } from "@/lib/server-config";

type McpPayoutDraftBody = {
  walletAddress?: string;
  entryMode?: PayoutRunEntryMode;
  rows?: Array<{
    recipientName?: string;
    walletAddress?: string;
    amount?: string;
    clientRefId?: string;
  }>;
};

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function buildApprovalUrl(appUrl: string, entryMode: PayoutRunEntryMode, runId: string) {
  const baseUrl = appUrl.replace(/\/$/, "");
  const url = new URL(entryMode === "manual" ? "/pay" : "/bulk-pay", baseUrl);
  url.searchParams.set("runId", runId);
  return url.toString();
}

export async function POST(request: Request) {
  const serverConfig = getServerConfig();

  if (!serverConfig.mcpApiToken) {
    return NextResponse.json({ error: "MCP_API_TOKEN is not configured." }, { status: 503 });
  }

  if (getBearerToken(request) !== serverConfig.mcpApiToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: McpPayoutDraftBody;
  try {
    body = (await request.json()) as McpPayoutDraftBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.walletAddress) {
    return NextResponse.json({ error: "walletAddress is required." }, { status: 400 });
  }

  let fundingWalletAddress: string;
  try {
    fundingWalletAddress = normalizeWalletAddress(body.walletAddress);
  } catch {
    return NextResponse.json({ error: "Invalid funding wallet address." }, { status: 400 });
  }

  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return NextResponse.json({ error: "rows must include at least one payout row." }, { status: 400 });
  }

  const entryMode = body.entryMode ?? (body.rows.length === 1 ? "manual" : "csv");
  if (entryMode !== "manual" && entryMode !== "csv") {
    return NextResponse.json({ error: "entryMode must be manual or csv." }, { status: 400 });
  }

  if (entryMode === "manual" && body.rows.length > 1) {
    return NextResponse.json({ error: "manual drafts can only include one payout row." }, { status: 400 });
  }

  const user = await findUserByWalletAddress(fundingWalletAddress);
  if (!user) {
    return NextResponse.json(
      { error: "Funding wallet has no CipherPay user. Sign in with this wallet once before using the MCP server." },
      { status: 404 },
    );
  }

  const rows: PayoutRowDraft[] = body.rows.map((row) => ({
    id: crypto.randomUUID(),
    recipientName: typeof row.recipientName === "string" ? row.recipientName.trim() : "",
    walletAddress: typeof row.walletAddress === "string" ? row.walletAddress.trim() : "",
    amount: typeof row.amount === "string" ? row.amount.trim() : "",
    clientRefId: typeof row.clientRefId === "string" ? row.clientRefId.trim() : undefined,
  }));

  const asset = getPrivatePayoutAsset();
  const issues = validateRows(rows, { symbol: asset.symbol, decimals: asset.decimals });
  const blockingIssues = issues
    .map((issue, index): { index: number; issue: PayoutRowIssue } => ({ index, issue }))
    .filter(({ issue }) => Object.keys(issue).length > 0);

  if (blockingIssues.length > 0) {
    return NextResponse.json(
      {
        error: "Payout rows failed validation.",
        issues: blockingIssues,
      },
      { status: 422 },
    );
  }

  const run = await upsertDraftPayoutRun({
    userId: user.userId,
    walletAddress: user.walletAddress,
    entryMode,
    source: "mcp",
    rows,
  });

  return NextResponse.json({
    ok: true,
    run,
    approvalUrl: buildApprovalUrl(serverConfig.appUrl, run.entryMode, run.id),
    nextAction: "Open the approval URL in CipherPay and approve execution with the connected wallet.",
  });
}
