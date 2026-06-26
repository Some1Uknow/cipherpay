import { NextResponse } from "next/server";

import { decryptNullable } from "@/lib/agent-pay/crypto";
import { getDb } from "@/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = getDb();
  const result = await db.query<{
    invoice_number: string;
    amount_input: string;
    asset_symbol: string;
    encrypted_title: string;
    encrypted_description: string | null;
    status: string;
    due_at: Date | null;
    issuer_handle: string;
  }>(
    `
      select i.invoice_number, i.amount_input, i.asset_symbol, i.encrypted_title, i.encrypted_description, i.status, i.due_at, a.handle as issuer_handle
      from agent_invoices i
      join agents a on a.id = i.issuer_agent_id
      where i.human_payment_slug = $1
      limit 1
    `,
    [slug],
  );
  const invoice = result.rows[0];
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  return NextResponse.json({
    ok: true,
    invoice: {
      invoiceNumber: invoice.invoice_number,
      issuerHandle: invoice.issuer_handle,
      amountInput: invoice.amount_input,
      assetSymbol: invoice.asset_symbol,
      title: decryptNullable(invoice.encrypted_title),
      description: decryptNullable(invoice.encrypted_description),
      status: invoice.status,
      dueAt: invoice.due_at?.toISOString() ?? null,
    },
  });
}
