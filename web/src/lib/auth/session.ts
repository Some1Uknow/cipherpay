import crypto from "crypto";

import { getServerConfig } from "@/lib/server-config";

export type SessionRecord = {
  id: string;
  userId: string;
  walletAddress: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export const createSessionToken = (): string => {
  return crypto.randomBytes(32).toString("base64url");
};

export const hashSessionToken = (token: string): string => {
  const serverConfig = getServerConfig();
  return crypto.createHmac("sha256", serverConfig.sessionSigningSecret).update(token).digest("hex");
};

export const getSessionExpiryDate = (now = new Date()): Date => {
  const serverConfig = getServerConfig();
  const expiresAt = new Date(now);
  expiresAt.setHours(expiresAt.getHours() + serverConfig.sessionTtlHours);
  return expiresAt;
};

export const isSessionExpired = (expiresAt: Date | string, now = new Date()): boolean => {
  const target = typeof expiresAt === "string" ? new Date(expiresAt) : expiresAt;
  return target.getTime() <= now.getTime();
};
