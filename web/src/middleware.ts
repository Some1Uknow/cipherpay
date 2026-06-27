import { NextRequest, NextResponse } from "next/server";

import { INVITE_COOKIE_NAME, inviteCookieValue } from "@/lib/invite";

const PUBLIC_FILE = /\.(.*)$/;

const PUBLIC_PATHS = new Set(["/", "/invite", "/api/invite", "/api/waitlist"]);

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/logo/") ||
    pathname.startsWith("/public/") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const inviteCode = process.env.INVITE_CODE?.trim();
  if (!inviteCode || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const expectedCookie = await inviteCookieValue(inviteCode);
  const actualCookie = request.cookies.get(INVITE_COOKIE_NAME)?.value;
  if (actualCookie === expectedCookie) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Invite code required." }, { status: 403 });
  }

  const inviteUrl = request.nextUrl.clone();
  inviteUrl.pathname = "/invite";
  inviteUrl.search = "";
  inviteUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.rewrite(inviteUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};

