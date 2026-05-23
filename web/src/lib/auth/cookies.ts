import { cookies } from "next/headers";

import { getServerConfig } from "@/lib/server-config";

export const setSessionCookie = async (token: string, expiresAt: Date): Promise<void> => {
  const cookieStore = await cookies();
  const serverConfig = getServerConfig();

  const secure = serverConfig.appUrl.startsWith("https://") || process.env.NODE_ENV === "production";

  cookieStore.set(serverConfig.sessionCookieName, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
};

export const clearSessionCookie = async (): Promise<void> => {
  const cookieStore = await cookies();
  const serverConfig = getServerConfig();
  cookieStore.delete(serverConfig.sessionCookieName);
};

export const getSessionCookie = async (): Promise<string | undefined> => {
  const cookieStore = await cookies();
  const serverConfig = getServerConfig();
  return cookieStore.get(serverConfig.sessionCookieName)?.value;
};
