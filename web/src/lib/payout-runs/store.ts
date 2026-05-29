import "server-only";

import { getDb } from "@/lib/db";
import { decimalAmountToBaseUnits, sumBaseUnitAmounts } from "@/lib/cloak/amounts";
import { getPrivatePayoutAsset } from "@/lib/cloak/config";
import { publicConfig } from "@/lib/public-config";
import type { PersistedPayoutRun, PayoutRowDraft, PayoutRowStatus, PayoutRunEntryMode, PayoutRunStatus } from "@/lib/payout-runs/types";
import { isRowFilled, validateRows } from "@/lib/payout-runs/validation";

type RunRow = {
  id: string;
  user_id: string;
  wallet_address: string;
  entry_mode: PayoutRunEntryMode;
  status: PayoutRunStatus;
  total_amount: string;
  payout_rail: string;
  asset_mint: string | null;
  asset_symbol: string;
  asset_decimals: number;
  total_base_units: string | null;
  privacy_cluster: string | null;
  cloak_program_id: string | null;
  cloak_relay_url: string | null;
  private_deposit_signature: string | null;
  private_status: string | null;
  total_fee_base_units: string | null;
  total_net_base_units: string | null;
  current_change_utxo_commitment: string | null;
  recovery_state: string | null;
  private_balance_before: string | null;
  private_balance_after: string | null;
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
  amount_base_units?: string | null;
  row_status?: PayoutRowStatus;
  tx_signature?: string | null;
  client_ref_id?: string | null;
  gross_base_units?: string | null;
  fee_base_units?: string | null;
  net_base_units?: string | null;
  private_withdraw_signature?: string | null;
  attempt_count?: number;
  private_status?: string | null;
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
    payoutRail: "cloak",
    assetMint: run.asset_mint,
    assetSymbol: run.asset_symbol,
    assetDecimals: run.asset_decimals,
    totalBaseUnits: run.total_base_units,
    privacyCluster: run.privacy_cluster,
    cloakProgramId: run.cloak_program_id,
    cloakRelayUrl: run.cloak_relay_url,
    privateDepositSignature: run.private_deposit_signature,
    privateStatus: run.private_status,
    totalFeeBaseUnits: run.total_fee_base_units,
    totalNetBaseUnits: run.total_net_base_units,
    currentChangeUtxoCommitment: run.current_change_utxo_commitment,
    recoveryState: run.recovery_state,
    privateBalanceBefore: run.private_balance_before,
    privateBalanceAfter: run.private_balance_after,
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
        amountBaseUnits: item.amount_base_units,
        rowStatus: item.row_status,
        txSignature: item.tx_signature,
        clientRefId: item.client_ref_id,
        privateWithdrawSignature: item.private_withdraw_signature,
        grossBaseUnits: item.gross_base_units,
        feeBaseUnits: item.fee_base_units,
        netBaseUnits: item.net_base_units,
        attemptCount: item.attempt_count,
        privateStatus: item.private_status,
        errorMessage: item.error_message,
      })),
  };
}

function summarizeRows(rows: PayoutRowDraft[]) {
  const asset = getPrivatePayoutAsset();
  const filledRows = rows.filter(isRowFilled);
  const issues = validateRows(filledRows, {
    symbol: asset.symbol,
    decimals: asset.decimals,
  });
  const validBaseUnits = filledRows.map((row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return null;
    return decimalAmountToBaseUnits(row.amount, asset.decimals);
  });
  const total = filledRows.reduce((sum, row, index) => {
    if (Object.keys(issues[index] ?? {}).length > 0) return sum;
    const amount = Number(row.amount);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
  const totalBaseUnits = sumBaseUnitAmounts(validBaseUnits.filter((value): value is bigint => value !== null));

  const status: PayoutRunStatus =
    filledRows.length > 0 && issues.every((issue) => Object.keys(issue).length === 0) ? "ready" : "draft";

  return { asset, filledRows, total, totalBaseUnits, status };
}

function formatStoredAmount(amount: number, decimals: number = publicConfig.phase1TokenDecimals) {
  return amount.toLocaleString("en-US", {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

async function getItemsForRunIds(runIds: string[]): Promise<Map<string, ItemRow[]>> {
  if (runIds.length === 0) return new Map();

  const db = getDb();
  const result = await db.query<ItemRow>(
    `
      select id, run_id, position, recipient_name, recipient_wallet_address, amount_input
        , amount_base_units, gross_base_units, fee_base_units, net_base_units, row_status
        , tx_signature, client_ref_id, private_withdraw_signature, attempt_count, private_status, error_message
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

export async function getLatestOpenPayoutRunForUser(
  userId: string,
  entryMode?: PayoutRunEntryMode,
): Promise<PersistedPayoutRun | null> {
  const db = getDb();
  const entryModeClause = entryMode ? "and entry_mode = $2" : "";
  const params = entryMode ? [userId, entryMode] : [userId];
  const runResult = await db.query<RunRow>(
    `
      select *
      from payout_runs
      where user_id = $1
        ${entryModeClause}
        and status in ('draft', 'ready', 'depositing', 'deposit_confirmed', 'paying', 'partially_paid', 'recoverable')
      order by last_interacted_at desc
      limit 1
    `,
    params,
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

  const { asset, filledRows, total, totalBaseUnits, status } = summarizeRows(params.rows);

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
            payout_rail = $8,
            asset_mint = $9,
            asset_symbol = $10,
            asset_decimals = $11,
            total_base_units = $12,
            privacy_cluster = $13,
            cloak_program_id = $14,
            cloak_relay_url = $15,
            updated_at = now(),
            last_interacted_at = now()
          where id = $1
            and user_id = $7
          returning *
        `,
        [
          params.runId,
          params.walletAddress,
          params.entryMode,
          status,
          formatStoredAmount(total, asset.decimals),
          filledRows.length,
          params.userId,
          publicConfig.payoutRail,
          asset.mint,
          asset.symbol,
          asset.decimals,
          totalBaseUnits.toString(),
          publicConfig.solanaCluster,
          publicConfig.cloakProgramId,
          publicConfig.cloakRelayUrl,
        ],
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
            item_count,
            payout_rail,
            asset_mint,
            asset_symbol,
            asset_decimals,
            total_base_units,
            privacy_cluster,
            cloak_program_id,
            cloak_relay_url
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          returning *
        `,
        [
          params.userId,
          params.walletAddress,
          params.entryMode,
          status,
          formatStoredAmount(total, asset.decimals),
          filledRows.length,
          publicConfig.payoutRail,
          asset.mint,
          asset.symbol,
          asset.decimals,
          totalBaseUnits.toString(),
          publicConfig.solanaCluster,
          publicConfig.cloakProgramId,
          publicConfig.cloakRelayUrl,
        ],
      );
      run = runResult.rows[0];
    }

    if (!run) {
      throw new Error("Failed to create payout run.");
    }

    await client.query(`delete from payout_run_items where run_id = $1`, [run.id]);

    if (params.rows.length > 0) {
      const insertValues: string[] = [];
      const bindValues: Array<string | number | null> = [];

      params.rows.forEach((row, index) => {
        const offset = index * 11;
        insertValues.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`,
        );
        const rowIssues = validateRows([row], {
          symbol: asset.symbol,
          decimals: asset.decimals,
        })[0];
        const isReady = Object.keys(rowIssues ?? {}).length === 0;
        const amountBaseUnits = isReady ? decimalAmountToBaseUnits(row.amount, asset.decimals).toString() : null;
        bindValues.push(
          run!.id,
          index,
          row.recipientName.trim(),
          row.walletAddress.trim(),
          row.amount.trim(),
          amountBaseUnits,
          amountBaseUnits,
          null,
          null,
          Object.keys(rowIssues ?? {}).length === 0 ? "ready" : "draft",
          row.clientRefId && /^\d+$/.test(row.clientRefId) ? row.clientRefId : `${Date.now()}${index.toString().padStart(3, "0")}`,
          isReady ? "ready" : "draft",
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
            amount_base_units,
            gross_base_units,
            fee_base_units,
            net_base_units,
            row_status,
            client_ref_id,
            private_status
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
  privateDepositSignature?: string | null;
  privateStatus?: string | null;
  totalFeeBaseUnits?: string | null;
  totalNetBaseUnits?: string | null;
  currentChangeUtxoCommitment?: string | null;
  recoveryState?: string | null;
  privateBalanceBefore?: string | null;
  privateBalanceAfter?: string | null;
  rows: Array<{
    id: string;
    rowStatus: PayoutRowStatus;
    txSignature?: string | null;
    privateWithdrawSignature?: string | null;
    grossBaseUnits?: string | null;
    feeBaseUnits?: string | null;
    netBaseUnits?: string | null;
    privateStatus?: string | null;
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
          private_deposit_signature = coalesce($4, private_deposit_signature),
          private_status = coalesce($5, private_status),
          total_fee_base_units = coalesce($6, total_fee_base_units),
          total_net_base_units = coalesce($7, total_net_base_units),
          current_change_utxo_commitment = coalesce($8, current_change_utxo_commitment),
          recovery_state = coalesce($9, recovery_state),
          private_balance_before = coalesce($10, private_balance_before),
          private_balance_after = coalesce($11, private_balance_after),
          updated_at = now(),
          last_interacted_at = now(),
          submitted_at = case when $3 in ('depositing', 'deposit_confirmed', 'paying', 'partially_paid', 'completed', 'failed', 'recoverable') then coalesce(submitted_at, now()) else submitted_at end
        where id = $1
          and user_id = $2
        returning *
      `,
      [
        params.runId,
        params.userId,
        params.status,
        params.privateDepositSignature ?? null,
        params.privateStatus ?? null,
        params.totalFeeBaseUnits ?? null,
        params.totalNetBaseUnits ?? null,
        params.currentChangeUtxoCommitment ?? null,
        params.recoveryState ?? null,
        params.privateBalanceBefore ?? null,
        params.privateBalanceAfter ?? null,
      ],
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
            private_withdraw_signature = coalesce($5, private_withdraw_signature),
            gross_base_units = coalesce($6, gross_base_units),
            fee_base_units = coalesce($7, fee_base_units),
            net_base_units = coalesce($8, net_base_units),
            private_status = coalesce($9, private_status),
            error_message = $10,
            attempt_count = case when $3 in ('paying', 'failed') then attempt_count + 1 else attempt_count end,
            last_attempt_at = case when $3 in ('paying', 'failed') then now() else last_attempt_at end,
            updated_at = now()
          where id = $1
            and run_id = $2
        `,
        [
          row.id,
          params.runId,
          row.rowStatus,
          row.txSignature ?? row.privateWithdrawSignature ?? null,
          row.privateWithdrawSignature ?? null,
          row.grossBaseUnits ?? null,
          row.feeBaseUnits ?? null,
          row.netBaseUnits ?? null,
          row.privateStatus ?? row.rowStatus,
          row.errorMessage ?? null,
        ],
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

export async function getPayoutRunForUser(params: {
  runId: string;
  userId: string;
}): Promise<PersistedPayoutRun | null> {
  const db = getDb();
  const runResult = await db.query<RunRow>(
    `
      select *
      from payout_runs
      where id = $1
        and user_id = $2
      limit 1
    `,
    [params.runId, params.userId],
  );

  const run = runResult.rows[0];
  if (!run) return null;

  const itemsByRun = await getItemsForRunIds([run.id]);
  return mapRun(run, itemsByRun.get(run.id) ?? []);
}
