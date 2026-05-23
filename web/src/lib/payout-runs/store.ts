import "server-only";

import { getDb } from "@/lib/db";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRunEntryMode, PayoutRunStatus } from "@/lib/payout-runs/types";
import { isRowFilled, validateRows } from "@/lib/payout-runs/validation";

type RunRow = {
  id: string;
  user_id: string;
  wallet_address: string;
  entry_mode: PayoutRunEntryMode;
  status: PayoutRunStatus;
  total_amount: string;
  item_count: number;
  created_at: Date;
  updated_at: Date;
  last_interacted_at: Date;
  submitted_at: Date | null;
};

type ItemRow = {
  id: string;
  run_id: string;
  position: number;
  recipient_name: string;
  recipient_wallet_address: string;
  amount_input: string;
  row_status?: "draft" | "ready" | "submitted" | "confirmed" | "failed";
  tx_signature?: string | null;
  error_message?: string | null;
};

function mapRun(run: RunRow, items: ItemRow[]): PersistedPayoutRun {
  return {
    id: run.id,
    userId: run.user_id,
    walletAddress: run.wallet_address,
    entryMode: run.entry_mode,
    status: run.status,
    totalAmount: run.total_amount,
    itemCount: run.item_count,
    createdAt: run.created_at.toISOString(),
    updatedAt: run.updated_at.toISOString(),
    lastInteractedAt: run.last_interacted_at.toISOString(),
    submittedAt: run.submitted_at ? run.submitted_at.toISOString() : null,
    rows: items
      .sort((a, b) => a.position - b.position)
      .map((item) => ({
        id: item.id,
        recipientName: item.recipient_name,
        walletAddress: item.recipient_wallet_address,
        amount: item.amount_input,
        rowStatus: item.row_status,
        txSignature: item.tx_signature,
        errorMessage: item.error_message,
      })),
  };
}

function summarizeRows(rows: PayoutRowDraft[]) {
  const filledRows = rows.filter(isRowFilled);
  const issues = validateRows(filledRows);
  const total = filledRows.reduce((sum, row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return sum;
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const status: PayoutRunStatus =
    filledRows.length > 0 && issues.every((issue) => Object.keys(issue).length === 0) ? "ready" : "draft";

  return { filledRows, total, status };
}

async function getItemsForRunIds(runIds: string[]): Promise<Map<string, ItemRow[]>> {
  if (runIds.length === 0) return new Map();

  const db = getDb();
  const result = await db.query<ItemRow>(
    `
      select id, run_id, position, recipient_name, recipient_wallet_address, amount_input
      from payout_run_items
      where run_id = any($1::uuid[])
      order by position asc
    `,
    [runIds],
  );

  const itemsByRun = new Map<string, ItemRow[]>();
  for (const row of result.rows) {
    const current = itemsByRun.get(row.run_id) ?? [];
    current.push(row);
    itemsByRun.set(row.run_id, current);
  }
  return itemsByRun;
}

export async function getLatestOpenPayoutRunForUser(userId: string): Promise<PersistedPayoutRun | null> {
  const db = getDb();
  const runResult = await db.query<RunRow>(
    `
      select *
      from payout_runs
      where user_id = $1
        and status in ('draft', 'ready')
      order by last_interacted_at desc
      limit 1
    `,
    [userId],
  );

  const run = runResult.rows[0];
  if (!run) return null;

  const itemsByRun = await getItemsForRunIds([run.id]);
  return mapRun(run, itemsByRun.get(run.id) ?? []);
}

export async function listPayoutRunsForUser(userId: string, limit = 10): Promise<PersistedPayoutRun[]> {
  const db = getDb();
  const runResult = await db.query<RunRow>(
    `
      select *
      from payout_runs
      where user_id = $1
      order by last_interacted_at desc
      limit $2
    `,
    [userId, limit],
  );

  const runs = runResult.rows;
  const itemsByRun = await getItemsForRunIds(runs.map((run) => run.id));
  return runs.map((run) => mapRun(run, itemsByRun.get(run.id) ?? []));
}

export async function upsertDraftPayoutRun(params: {
  userId: string;
  walletAddress: string;
  entryMode: PayoutRunEntryMode;
  rows: PayoutRowDraft[];
  runId?: string | null;
}): Promise<PersistedPayoutRun> {
  const db = getDb();
  const client = await db.connect();

  const { filledRows, total, status } = summarizeRows(params.rows);

  try {
    await client.query("begin");

    let run: RunRow | undefined;

    if (params.runId) {
      const runResult = await client.query<RunRow>(
        `
          update payout_runs
          set
            wallet_address = $2,
            entry_mode = $3,
            status = $4,
            total_amount = $5,
            item_count = $6,
            updated_at = now(),
            last_interacted_at = now()
          where id = $1
            and user_id = $7
          returning *
        `,
        [params.runId, params.walletAddress, params.entryMode, status, total.toFixed(2), filledRows.length, params.userId],
      );
      run = runResult.rows[0];
    }

    if (!run) {
      const runResult = await client.query<RunRow>(
        `
          insert into payout_runs (
            user_id,
            wallet_address,
            entry_mode,
            status,
            total_amount,
            item_count
          )
          values ($1, $2, $3, $4, $5, $6)
          returning *
        `,
        [params.userId, params.walletAddress, params.entryMode, status, total.toFixed(2), filledRows.length],
      );
      run = runResult.rows[0];
    }

    if (!run) {
      throw new Error("Failed to create payout run.");
    }

    await client.query(`delete from payout_run_items where run_id = $1`, [run.id]);

    if (filledRows.length > 0) {
      const insertValues: string[] = [];
      const bindValues: Array<string | number> = [];

      filledRows.forEach((row, index) => {
        const offset = index * 6;
        insertValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        const rowIssues = validateRows([row])[0];
        bindValues.push(
          run!.id,
          index,
          row.recipientName.trim(),
          row.walletAddress.trim(),
          row.amount.trim(),
          Object.keys(rowIssues ?? {}).length === 0 ? "ready" : "draft",
        );
      });

      await client.query(
        `
          insert into payout_run_items (
            run_id,
            position,
            recipient_name,
            recipient_wallet_address,
            amount_input,
            row_status
          )
          values ${insertValues.join(", ")}
        `,
        bindValues,
      );
    }

    await client.query("commit");

    const itemsByRun = await getItemsForRunIds([run.id]);
    return mapRun(run, itemsByRun.get(run.id) ?? []);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function updatePayoutRunExecution(params: {
  runId: string;
  userId: string;
  status: PayoutRunStatus;
  rows: Array<{
    id: string;
    rowStatus: "draft" | "ready" | "submitted" | "confirmed" | "failed";
    txSignature?: string | null;
    errorMessage?: string | null;
  }>;
}): Promise<PersistedPayoutRun> {
  const db = getDb();
  const client = await db.connect();

  try {
    await client.query("begin");

    const runResult = await client.query<RunRow>(
      `
        update payout_runs
        set
          status = $3,
          updated_at = now(),
          last_interacted_at = now(),
          submitted_at = case when $3 in ('submitted', 'completed', 'failed') then coalesce(submitted_at, now()) else submitted_at end
        where id = $1
          and user_id = $2
        returning *
      `,
      [params.runId, params.userId, params.status],
    );

    const run = runResult.rows[0];
    if (!run) {
      throw new Error("Payout run not found.");
    }

    for (const row of params.rows) {
      await client.query(
        `
          update payout_run_items
          set
            row_status = $3,
            tx_signature = $4,
            error_message = $5,
            updated_at = now()
          where id = $1
            and run_id = $2
        `,
        [row.id, params.runId, row.rowStatus, row.txSignature ?? null, row.errorMessage ?? null],
      );
    }

    await client.query("commit");

    const itemsByRun = await getItemsForRunIds([run.id]);
    return mapRun(run, itemsByRun.get(run.id) ?? []);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
