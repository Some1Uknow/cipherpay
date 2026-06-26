import { NextResponse } from "next/server";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { resolveAgentByToken } from "@/lib/agent-pay/store";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireAgent(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    return { error: jsonError("Missing agent bearer token.", 401), agent: null };
  }
  const agent = await resolveAgentByToken(token);
  if (!agent) {
    return { error: jsonError("Invalid or revoked agent token.", 401), agent: null };
  }
  return { error: null, agent };
}

export function verifyAgentSignature(params: {
  agentWalletAddress: string;
  signature?: string;
  signedMessage?: string;
  expectedAction: string;
}) {
  if (!params.signature || !params.signedMessage) return false;

  try {
    const messageBytes = new TextEncoder().encode(params.signedMessage);
    const signatureBytes = bs58.decode(params.signature);
    const publicKeyBytes = bs58.decode(params.agentWalletAddress);
    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!verified) return false;

    const lines = params.signedMessage.split("\n");
    const action = lines.find((line) => line.startsWith("Action: "))?.replace("Action: ", "");
    const timestampRaw = lines.find((line) => line.startsWith("Timestamp: "))?.replace("Timestamp: ", "");
    const timestamp = timestampRaw ? Date.parse(timestampRaw) : Number.NaN;
    const isFresh = Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;

    return (
      params.signedMessage.includes("CipherPay Agent Pay") &&
      params.signedMessage.includes(`Agent: ${params.agentWalletAddress}`) &&
      action === params.expectedAction &&
      isFresh
    );
  } catch {
    return false;
  }
}
