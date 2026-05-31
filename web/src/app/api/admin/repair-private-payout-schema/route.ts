import { NextResponse } from "next/server";

import { getDb } from "@/lib/db";

const REPAIR_SQL = `
  alter table payout_runs
    add column if not exists private_balance_before numeric(40, 0),
    add column if not exists private_balance_after numeric(40, 0)
`;

function isAuthorized(request: Request) {
  const token = process.env.ADMIN_MIGRATION_TOKEN?.trim();
  if (!token) return false;

  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${token}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const db = getDb();
  await db.query(REPAIR_SQL);

  return NextResponse.json({ ok: true });
}
