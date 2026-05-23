create table if not exists payout_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  wallet_address text not null,
  entry_mode text not null check (entry_mode in ('manual', 'csv')),
  status text not null check (status in ('draft', 'ready', 'submitting', 'submitted', 'failed', 'completed')),
  total_amount numeric(20, 2) not null default 0,
  item_count integer not null default 0 check (item_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_interacted_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists payout_runs_user_recent_idx on payout_runs(user_id, last_interacted_at desc);
create index if not exists payout_runs_status_idx on payout_runs(user_id, status, last_interacted_at desc);

create table if not exists payout_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references payout_runs(id) on delete cascade,
  position integer not null check (position >= 0),
  recipient_name text not null default '',
  recipient_wallet_address text not null default '',
  amount_input text not null default '',
  row_status text not null check (row_status in ('draft', 'ready', 'submitted', 'confirmed', 'failed')),
  error_message text,
  tx_signature text,
  receipt_address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, position)
);

create index if not exists payout_run_items_run_idx on payout_run_items(run_id, position);
