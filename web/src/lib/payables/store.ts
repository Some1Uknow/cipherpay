import "server-only";

import { getDb } from "@/lib/db";
import { upsertDraftPayoutRun } from "@/lib/payout-runs/store";
import type { PersistedPayoutRun, PayoutRowDraft } from "@/lib/payout-runs/types";
import { validateRows } from "@/lib/payout-runs/validation";
import { getPrivatePayoutAsset } from "@/lib/cloak/config";
import type { PayableCadence, PayableRecord } from "@/lib/payables/types";

type PayableRow = {
  id: string;
  user_id: string;
  recipient_name: string;
  wallet_address: string;
  amount_input: string;
  cadence: PayableCadence;
  next_due_on: string | Date;
  memo: string | null;
  active: boolean;
  last_drafted_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type CreatePayableParams = {
  userId: string;
  recipientName: string;
  walletAddress: string;
  amount: string;
  cadence: PayableCadence;
  nextDueOn: string;
  memo?: string | null;
};

function toDateOnly(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function mapPayable(row: PayableRow): PayableRecord {
  return {
    id: row.id,
    userId: row.user_id,
    recipientName: row.recipient_name,
    walletAddress: row.wallet_address,
    amount: row.amount_input,
    cadence: row.cadence,
    nextDueOn: toDateOnly(row.next_due_on),
    memo: row.memo,
    active: row.active,
    lastDraftedAt: row.last_drafted_at ? row.last_drafted_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function normalizeCadence(value: string): PayableCadence {
  if (value === "weekly" || value === "monthly" || value === "one_time") return value;
  throw new Error("Cadence must be weekly, monthly, or one_time.");
}

function assertDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Next due date must use YYYY-MM-DD.");
  }
}

function validatePayableDraft(params: CreatePayableParams) {
  const asset = getPrivatePayoutAsset();
  const row: PayoutRowDraft = {
    id: "payable-validation",
    recipientName: params.recipientName.trim(),
    walletAddress: params.walletAddress.trim(),
    amount: params.amount.trim(),
  };
  const issues = validateRows([row], {
    symbol: asset.symbol,
    decimals: asset.decimals,
    minimumAmount: asset.symbol === "SOL" ? 0.01 : undefined,
  })[0];
  const issueValues = Object.values(issues ?? {}).filter(Boolean);
  if (issueValues.length > 0) {
    throw new Error(issueValues[0]);
  }
}

export async function listPayablesForUser(userId: string): Promise<PayableRecord[]> {
  const db = getDb();
  const result = await db.query<PayableRow>(
    `
      select *
      from payables
      where user_id = $1
      order by active desc, next_due_on asc, updated_at desc
    `,
    [userId],
  );
  return result.rows.map(mapPayable);
}

export async function createPayableForUser(params: CreatePayableParams): Promise<PayableRecord> {
  const cadence = normalizeCadence(params.cadence);
  assertDateOnly(params.nextDueOn);
  validatePayableDraft({ ...params, cadence });

  const db = getDb();
  const result = await db.query<PayableRow>(
    `
      insert into payables (
        user_id,
        recipient_name,
        wallet_address,
        amount_input,
        cadence,
        next_due_on,
        memo
      )
      values ($1, $2, $3, $4, $5, $6, $7)
      returning *
    `,
    [
      params.userId,
      params.recipientName.trim(),
      params.walletAddress.trim(),
      params.amount.trim(),
      cadence,
      params.nextDueOn,
      params.memo?.trim() || null,
    ],
  );

  return mapPayable(result.rows[0]);
}

export async function createDraftFromPayables(params: {
  userId: string;
  walletAddress: string;
  payableIds: string[];
}): Promise<PersistedPayoutRun> {
  const uniqueIds = Array.from(new Set(params.payableIds)).filter(Boolean);
  if (uniqueIds.length === 0) {
    throw new Error("Select at least one payable.");
  }

  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");
    const payablesResult = await client.query<PayableRow>(
      `
        select *
        from payables
        where user_id = $1
          and active = true
          and id = any($2::uuid[])
        order by next_due_on asc, created_at asc
      `,
      [params.userId, uniqueIds],
    );

    if (payablesResult.rows.length === 0) {
      throw new Error("No active payables were found.");
    }

    const rows: PayoutRowDraft[] = payablesResult.rows.map((payable) => ({
      id: crypto.randomUUID(),
      recipientName: payable.recipient_name,
      walletAddress: payable.wallet_address,
      amount: payable.amount_input,
      clientRefId: payable.id.replace(/-/g, "").slice(0, 18),
    }));

    const run = await upsertDraftPayoutRun({
      userId: params.userId,
      walletAddress: params.walletAddress,
      entryMode: "csv",
      source: "payables",
      rows,
    });

    await client.query(
      `
        update payables
        set
          last_drafted_at = now(),
          next_due_on = case
            when cadence = 'weekly' then next_due_on + interval '7 days'
            when cadence = 'monthly' then next_due_on + interval '1 month'
            else next_due_on
          end,
          active = case when cadence = 'one_time' then false else active end,
          updated_at = now()
        where user_id = $1
          and id = any($2::uuid[])
      `,
      [params.userId, payablesResult.rows.map((payable) => payable.id)],
    );

    await client.query("commit");
    return run;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
