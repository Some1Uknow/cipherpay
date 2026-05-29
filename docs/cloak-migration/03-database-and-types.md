# Phase 3: Database And Types

This phase converts payout persistence from MagicBlock-specific fields to Cloak/private-rail fields.

## Goal

The database should describe CipherPay payout runs, not MagicBlock internals.

Use:

```txt
payout_rail = cloak
entry_mode = manual | csv
status = draft | ready | depositing | deposit_confirmed | paying | partially_paid | completed | failed | recoverable
```

## Migration File

Create:

```txt
web/db/004_cloak_private_payouts.sql
```

Suggested migration:

```sql
alter table payout_runs
  alter column payout_rail set default 'cloak',
  add column if not exists privacy_cluster text,
  add column if not exists cloak_program_id text,
  add column if not exists cloak_relay_url text,
  add column if not exists private_deposit_signature text,
  add column if not exists private_status text,
  add column if not exists total_fee_base_units numeric(40, 0),
  add column if not exists total_net_base_units numeric(40, 0),
  add column if not exists current_change_utxo_commitment text,
  add column if not exists recovery_state text;

alter table payout_run_items
  add column if not exists gross_base_units numeric(40, 0),
  add column if not exists fee_base_units numeric(40, 0),
  add column if not exists net_base_units numeric(40, 0),
  add column if not exists private_withdraw_signature text,
  add column if not exists private_commitment text,
  add column if not exists private_nullifier text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

alter table payout_runs
  drop constraint if exists payout_runs_status_check;

alter table payout_runs
  add constraint payout_runs_status_check
  check (status in (
    'draft',
    'ready',
    'depositing',
    'deposit_confirmed',
    'paying',
    'partially_paid',
    'completed',
    'failed',
    'recoverable'
  ));

alter table payout_run_items
  drop constraint if exists payout_run_items_row_status_check;

alter table payout_run_items
  add constraint payout_run_items_row_status_check
  check (row_status in (
    'draft',
    'ready',
    'queued',
    'paying',
    'paid_private',
    'failed'
  ));

create index if not exists payout_runs_private_status_idx
  on payout_runs(user_id, private_status, last_interacted_at desc);

create index if not exists payout_run_items_private_status_idx
  on payout_run_items(run_id, row_status, position);
```

Do not store raw UTXO private keys in Postgres. Recovery payloads should initially live client-side, then move to encrypted IndexedDB. If a server-side recovery design is later chosen, it must encrypt payloads client-side before upload.

## Backfill

If preserving old runs:

```sql
update payout_runs
set payout_rail = 'legacy_magicblock'
where payout_rail = 'magicblock_private_spl';
```

If old failed runs can be discarded, archive them outside the app and drop MagicBlock columns later.

## Type Changes

Update:

```txt
web/src/lib/payout-runs/types.ts
```

Suggested types:

```ts
export type PayoutRunEntryMode = "manual" | "csv";

export type PayoutRail = "cloak";

export type PayoutRunStatus =
  | "draft"
  | "ready"
  | "depositing"
  | "deposit_confirmed"
  | "paying"
  | "partially_paid"
  | "completed"
  | "failed"
  | "recoverable";

export type PayoutRowStatus =
  | "draft"
  | "ready"
  | "queued"
  | "paying"
  | "paid_private"
  | "failed";
```

`PayoutRowDraft` should replace MagicBlock fields with:

```ts
privateWithdrawSignature?: string | null;
grossBaseUnits?: string | null;
feeBaseUnits?: string | null;
netBaseUnits?: string | null;
attemptCount?: number;
privateStatus?: string | null;
errorMessage?: string | null;
```

`PersistedPayoutRun` should replace MagicBlock fields with:

```ts
payoutRail: "cloak";
privacyCluster: string | null;
cloakProgramId: string | null;
cloakRelayUrl: string | null;
privateDepositSignature: string | null;
privateStatus: string | null;
totalFeeBaseUnits: string | null;
totalNetBaseUnits: string | null;
currentChangeUtxoCommitment: string | null;
recoveryState: string | null;
```

## Store Layer

Update:

```txt
web/src/lib/payout-runs/store.ts
```

Required changes:

- Import amount helpers from `@/lib/cloak/amounts`.
- Import asset config from `@/lib/cloak/config` or a generic asset module.
- Remove `publicConfig.magicblockValidator`.
- Insert `payout_rail = 'cloak'`.
- Persist gross, fee, and net for each row.
- Persist deposit signature and row withdraw signatures.
- Increment attempt count on row retry.

## API Payloads

Update:

```txt
web/src/app/api/payout-runs/route.ts
web/src/app/api/payout-runs/[runId]/status/route.ts
```

Patch payload should accept:

```ts
{
  status: PayoutRunStatus;
  privateDepositSignature?: string | null;
  privateStatus?: string | null;
  totalFeeBaseUnits?: string | null;
  totalNetBaseUnits?: string | null;
  currentChangeUtxoCommitment?: string | null;
  recoveryState?: string | null;
  rows: Array<{
    id: string;
    rowStatus: PayoutRowStatus;
    privateWithdrawSignature?: string | null;
    grossBaseUnits?: string | null;
    feeBaseUnits?: string | null;
    netBaseUnits?: string | null;
    privateStatus?: string | null;
    errorMessage?: string | null;
  }>;
}
```

## Acceptance Criteria

- No type contains `magicblock`.
- New drafts insert with `payout_rail = cloak`.
- History can display old archived runs without breaking, or old MagicBlock runs are intentionally hidden.
- `pnpm typecheck` passes after the Cloak execution layer is wired.

