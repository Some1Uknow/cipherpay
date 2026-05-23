import "server-only";

import crypto from "crypto";
import { headers } from "next/headers";
import { PublicKey } from "@solana/web3.js";

export const normalizeWalletAddress = (value: string): string => {
  return new PublicKey(value).toBase58();
};

export const hashRequestValue = (value: string | null): string | null => {
  if (!value) return null;
  return crypto.createHash("sha256").update(value).digest("hex");
};

export const getRequestMetadata = async (): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
  ipHash: string | null;
  userAgentHash: string | null;
}> => {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");
  const userAgent = headerStore.get("user-agent");

  return {
    ipAddress: ipAddress ?? null,
    userAgent,
    ipHash: hashRequestValue(ipAddress ?? null),
    userAgentHash: hashRequestValue(userAgent),
  };
};
