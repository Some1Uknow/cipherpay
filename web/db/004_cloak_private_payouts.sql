alter table payout_runs
  add column if not exists payout_rail text not null default 'cloak',
  add column if not exists asset_mint text,
  add column if not exists asset_symbol text not null default 'SOL',
  add column if not exists asset_decimals integer not null default 9,
  add column if not exists total_base_units numeric(40, 0),
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
  add column if not exists amount_base_units numeric(40, 0),
  add column if not exists client_ref_id text,
  add column if not exists private_status text,
  add column if not exists gross_base_units numeric(40, 0),
  add column if not exists fee_base_units numeric(40, 0),
  add column if not exists net_base_units numeric(40, 0),
  add column if not exists private_withdraw_signature text,
  add column if not exists private_commitment text,
  add column if not exists private_nullifier text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz;

update payout_runs
set payout_rail = 'cloak'
where payout_rail <> 'cloak';

update payout_run_items
set gross_base_units = coalesce(gross_base_units, amount_base_units),
    private_status = coalesce(private_status, row_status)
where amount_base_units is not null;

alter table payout_runs
  alter column payout_rail set default 'cloak';

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

drop index if exists payout_runs_private_status_idx;
drop index if exists payout_run_items_private_status_idx;

create index if not exists payout_runs_private_status_idx on payout_runs(user_id, private_status, last_interacted_at desc);
create index if not exists payout_run_items_private_status_idx on payout_run_items(run_id, row_status, position);

alter table payout_runs
  drop column if exists magicblock_validator,
  drop column if exists magicblock_deposit_signature,
  drop column if exists magicblock_deposit_send_to,
  drop column if exists magicblock_private_status;

alter table payout_run_items
  drop column if exists magicblock_transfer_signature,
  drop column if exists magicblock_transfer_send_to,
  drop column if exists private_transfer_split,
  drop column if exists private_transfer_min_delay_ms,
  drop column if exists private_transfer_max_delay_ms;
