import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { INVITE_COOKIE_MAX_AGE_SECONDS, INVITE_COOKIE_NAME, inviteCookieValue, isValidInviteCode } from "@/lib/invite";

type InviteRequestBody = {
  code?: string;
};

export async function POST(request: Request) {
  let body: InviteRequestBody;

  try {
    body = (await request.json()) as InviteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  if (!isValidInviteCode(code)) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(INVITE_COOKIE_NAME, await inviteCookieValue(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.json({ ok: true });
}

