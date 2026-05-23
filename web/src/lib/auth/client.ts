"use client";

import bs58 from "bs58";

export type ChallengeResponse = {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
};

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

export async function createWalletSession(params: {
  walletAddress: string;
  signMessage: SignMessageFn;
}): Promise<void> {
  const challengeResponse = await fetch("/api/auth/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress: params.walletAddress }),
  });

  const challengePayload = (await challengeResponse.json()) as ChallengeResponse | { error: string };
  if (!challengeResponse.ok || !("message" in challengePayload)) {
    throw new Error("error" in challengePayload ? challengePayload.error : "Failed to create a sign-in challenge.");
  }

  const signatureBytes = await params.signMessage(new TextEncoder().encode(challengePayload.message));
  const signature = bs58.encode(signatureBytes);

  const verifyResponse = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: params.walletAddress,
      nonce: challengePayload.nonce,
      signature,
    }),
  });

  const verifyPayload = (await verifyResponse.json()) as { ok?: boolean; error?: string };
  if (!verifyResponse.ok || !verifyPayload.ok) {
    throw new Error(verifyPayload.error ?? "Failed to verify wallet signature.");
  }
}
