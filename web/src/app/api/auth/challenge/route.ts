import { NextResponse } from "next/server";

import { getRequestMetadata, normalizeWalletAddress } from "@/lib/auth/request";
import { SiwsMessage } from "@/lib/auth/siws";
import {
  AuthRateLimitError,
  assertChallengeRateLimit,
  createNonceValue,
  getSiwsExpiryDate,
  insertAuthNonce,
} from "@/lib/auth/store";
import { getServerConfig } from "@/lib/server-config";

type ChallengeRequestBody = {
  walletAddress?: string;
};

export async function POST(request: Request) {
  let body: ChallengeRequestBody;

  try {
    body = (await request.json()) as ChallengeRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.walletAddress) {
    return NextResponse.json({ error: "walletAddress is required." }, { status: 400 });
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeWalletAddress(body.walletAddress);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  const requestMetadata = await getRequestMetadata();

  try {
    await assertChallengeRateLimit(walletAddress, requestMetadata.ipHash);
  } catch (error) {
    if (error instanceof AuthRateLimitError) {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
        },
      );
    }

    throw error;
  }

  const issuedAt = new Date();
  const expiresAt = getSiwsExpiryDate(issuedAt);
  const nonce = createNonceValue();
  const serverConfig = getServerConfig();

  await insertAuthNonce({
    walletAddress,
    nonce,
    ipHash: requestMetadata.ipHash,
    userAgentHash: requestMetadata.userAgentHash,
    issuedAt,
    expiresAt,
  });

  const message = new SiwsMessage({
    domain: serverConfig.siwsDomain,
    address: walletAddress,
    statement: serverConfig.siwsStatement,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    uri: serverConfig.appUrl,
    chain: serverConfig.solanaCluster,
  }).toString();

  return NextResponse.json({
    walletAddress,
    nonce,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    message,
  });
}
