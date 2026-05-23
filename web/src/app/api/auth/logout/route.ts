import { NextResponse } from "next/server";

import { clearSessionCookie, getSessionCookie } from "@/lib/auth/cookies";
import { hashSessionToken } from "@/lib/auth/session";
import { revokeSessionByTokenHash } from "@/lib/auth/store";

export async function POST(request: Request) {
  const rawToken = await getSessionCookie();

  if (rawToken) {
    await revokeSessionByTokenHash(hashSessionToken(rawToken));
  }

  await clearSessionCookie();

  const redirectUrl = new URL("/", request.url);
  return NextResponse.redirect(redirectUrl);
}
