alter table payout_runs
  add column if not exists payout_rail text not null default 'magicblock_private_spl',
  add column if not exists asset_mint text,
  add column if not exists asset_symbol text not null default 'SOL',
  add column if not exists asset_decimals integer not null default 9,
  add column if not exists total_base_units numeric(40, 0),
  add column if not exists magicblock_validator text,
  add column if not exists magicblock_deposit_signature text,
  add column if not exists magicblock_deposit_send_to text,
  add column if not exists magicblock_private_status text,
  add column if not exists private_balance_before numeric(40, 0),
  add column if not exists private_balance_after numeric(40, 0);

alter table payout_run_items
  add column if not exists amount_base_units numeric(40, 0),
  add column if not exists client_ref_id text,
  add column if not exists magicblock_transfer_signature text,
  add column if not exists magicblock_transfer_send_to text,
  add column if not exists private_transfer_split integer not null default 1,
  add column if not exists private_transfer_min_delay_ms integer not null default 0,
  add column if not exists private_transfer_max_delay_ms integer not null default 0,
  add column if not exists private_status text;

alter table payout_runs
  drop constraint if exists payout_runs_status_check;

alter table payout_runs
  add constraint payout_runs_status_check
  check (status in (
    'draft',
    'ready',
    'deposit_required',
    'depositing',
    'deposit_confirmed',
    'transferring',
    'partially_paid',
    'submitting',
    'submitted',
    'failed',
    'completed'
  ));

alter table payout_run_items
  drop constraint if exists payout_run_items_row_status_check;

alter table payout_run_items
  add constraint payout_run_items_row_status_check
  check (row_status in (
    'draft',
    'ready',
    'queued',
    'paid_private',
    'submitted',
    'confirmed',
    'failed'
  ));

create index if not exists payout_runs_private_status_idx on payout_runs(user_id, magicblock_private_status, last_interacted_at desc);
create index if not exists payout_run_items_private_status_idx on payout_run_items(run_id, private_status, position);
