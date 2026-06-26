"use client";

import bs58 from "bs58";

export type ChallengeResponse = {
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
  message: string;
  signInInput: WalletSignInInput;
};

type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;
type WalletSignInInput = {
  domain?: string;
  address?: string;
  statement?: string;
  uri?: string;
  version?: string;
  chainId?: string;
  nonce?: string;
  issuedAt?: string;
  expirationTime?: string;
};
type WalletSignInOutput = {
  account: {
    address: string;
  };
  signedMessage: Uint8Array;
  signature: Uint8Array;
};
type SignInFn = (input?: WalletSignInInput) => Promise<WalletSignInOutput>;

export async function createWalletSession(params: {
  walletAddress: string;
  signMessage?: SignMessageFn;
  signIn?: SignInFn;
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

  let signature: string;
  let signedMessage: string | undefined;

  if (params.signMessage) {
    const signatureBytes = await params.signMessage(new TextEncoder().encode(challengePayload.message));
    signature = bs58.encode(signatureBytes);
  } else if (params.signIn) {
    const signInOutput = await params.signIn(challengePayload.signInInput);
    if (signInOutput.account.address !== params.walletAddress) {
      throw new Error("The wallet signed in with a different account. Choose the expected wallet and try again.");
    }

    signature = bs58.encode(signInOutput.signature);
    signedMessage = bs58.encode(signInOutput.signedMessage);
  } else {
    throw new Error("This wallet does not expose message signing. Use a supported Solana wallet.");
  }

  const verifyResponse = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress: params.walletAddress,
      nonce: challengePayload.nonce,
      signature,
      signedMessage,
    }),
  });

  const verifyPayload = (await verifyResponse.json()) as { ok?: boolean; error?: string };
  if (!verifyResponse.ok || !verifyPayload.ok) {
    throw new Error(verifyPayload.error ?? "Failed to verify wallet signature.");
  }
}
