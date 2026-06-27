import { NextResponse } from "next/server";

import { createWaitlistSignup } from "@/lib/waitlist/store";

type WaitlistRequestBody = {
  email?: string;
  feedback?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: WaitlistRequestBody;

  try {
    body = (await request.json()) as WaitlistRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";

  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  if (feedback.length > 2000) {
    return NextResponse.json({ error: "Feedback must be 2,000 characters or fewer." }, { status: 400 });
  }

  try {
    await createWaitlistSignup({ email, feedback });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not join the waitlist right now." }, { status: 500 });
  }
}

