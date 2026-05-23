import "server-only";

import { redirect } from "next/navigation";

import { getSessionCookie } from "@/lib/auth/cookies";
import { hashSessionToken, isSessionExpired } from "@/lib/auth/session";
import { findSessionUserByTokenHash } from "@/lib/auth/store";

export type AuthenticatedSession = {
  userId: string;
  walletAddress: string;
  displayName: string | null;
  sessionId: string;
  expiresAt: string;
};

export const getAuthenticatedSession = async (): Promise<AuthenticatedSession | null> => {
  const rawToken = await getSessionCookie();
  if (!rawToken) return null;

  const tokenHash = hashSessionToken(rawToken);
  const session = await findSessionUserByTokenHash(tokenHash);
  if (!session) return null;
  if (isSessionExpired(session.expiresAt)) return null;

  return session;
};

export const requireSession = async (redirectTo = "/pay"): Promise<AuthenticatedSession> => {
  const session = await getAuthenticatedSession();
  if (!session) {
    const target = redirectTo.startsWith("/") ? redirectTo : "/pay";
    redirect(`/?signin=1&next=${encodeURIComponent(target)}`);
  }

  return session;
};
