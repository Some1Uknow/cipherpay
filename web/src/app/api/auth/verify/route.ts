import { NextResponse } from "next/server";
import bs58 from "bs58";

import { setSessionCookie } from "@/lib/auth/cookies";
import { getRequestMetadata, normalizeWalletAddress } from "@/lib/auth/request";
import { createSessionToken, getSessionExpiryDate, hashSessionToken } from "@/lib/auth/session";
import { SiwsMessage } from "@/lib/auth/siws";
import {
  AuthRateLimitError,
  assertVerifyRateLimit,
  consumeAuthNonce,
  createSessionForWallet,
  findAuthNonce,
} from "@/lib/auth/store";
import { getServerConfig } from "@/lib/server-config";

type VerifyRequestBody = {
  walletAddress?: string;
  nonce?: string;
  signature?: string;
  signedMessage?: string;
};

export async function POST(request: Request) {
  let body: VerifyRequestBody;

  try {
    body = (await request.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.walletAddress || !body.nonce || !body.signature) {
    return NextResponse.json({ error: "walletAddress, nonce, and signature are required." }, { status: 400 });
  }

  let walletAddress: string;
  try {
    walletAddress = normalizeWalletAddress(body.walletAddress);
  } catch {
    return NextResponse.json({ error: "Invalid wallet address." }, { status: 400 });
  }

  try {
    await assertVerifyRateLimit(walletAddress);
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

  const authNonce = await findAuthNonce(walletAddress, body.nonce);
  if (!authNonce) {
    return NextResponse.json({ error: "Challenge not found. Request a new one." }, { status: 404 });
  }

  if (authNonce.consumed_at) {
    return NextResponse.json({ error: "Challenge already used. Request a new one." }, { status: 409 });
  }

  if (authNonce.expires_at.getTime() <= Date.now()) {
    await consumeAuthNonce(authNonce.id);
    return NextResponse.json({ error: "Challenge expired. Request a new one." }, { status: 410 });
  }

  const serverConfig = getServerConfig();
  const siwsMessage = new SiwsMessage({
    domain: serverConfig.siwsDomain,
    address: walletAddress,
    statement: serverConfig.siwsStatement,
    nonce: authNonce.nonce,
    issuedAt: authNonce.issued_at.toISOString(),
    expiresAt: authNonce.expires_at.toISOString(),
    uri: serverConfig.appUrl,
    chain: serverConfig.solanaCluster,
  });

  let signedMessageBytes: Uint8Array | undefined;
  if (body.signedMessage) {
    try {
      signedMessageBytes = bs58.decode(body.signedMessage);
    } catch {
      return NextResponse.json({ error: "Invalid signed message." }, { status: 400 });
    }

    const signedMessageText = new TextDecoder().decode(signedMessageBytes);
    const expectedLegacyMessage = siwsMessage.toString();
    const expectedStandardMessage = siwsMessage.toStandardString();

    if (!signedMessageText.includes(expectedLegacyMessage) && !signedMessageText.includes(expectedStandardMessage)) {
      await consumeAuthNonce(authNonce.id);
      return NextResponse.json({ error: "Signed message does not match the challenge. Request a new challenge." }, { status: 401 });
    }
  }

  const verified = await siwsMessage.verifySignature(body.signature, signedMessageBytes);
  if (!verified) {
    await consumeAuthNonce(authNonce.id);
    return NextResponse.json({ error: "Invalid signature. Request a new challenge." }, { status: 401 });
  }

  const consumed = await consumeAuthNonce(authNonce.id);
  if (!consumed) {
    return NextResponse.json({ error: "Challenge already used. Request a new one." }, { status: 409 });
  }

  const requestMetadata = await getRequestMetadata();
  const sessionToken = createSessionToken();
  const sessionTokenHash = hashSessionToken(sessionToken);
  const sessionExpiresAt = getSessionExpiryDate();

  const { userId } = await createSessionForWallet({
    walletAddress,
    tokenHash: sessionTokenHash,
    expiresAt: sessionExpiresAt,
    ipHash: requestMetadata.ipHash,
    userAgentHash: requestMetadata.userAgentHash,
  });

  await setSessionCookie(sessionToken, sessionExpiresAt);

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      walletAddress,
      sessionExpiresAt: sessionExpiresAt.toISOString(),
    },
  });
}
