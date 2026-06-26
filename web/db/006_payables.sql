alter table payout_runs
  drop constraint if exists payout_runs_source_check;

update payout_runs
set source = 'app'
where source is null or source not in ('app', 'payables');

alter table payout_runs
  add constraint payout_runs_source_check
  check (source in ('app', 'payables'));

create table if not exists payables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  recipient_name text not null,
  wallet_address text not null,
  amount_input text not null,
  cadence text not null check (cadence in ('weekly', 'monthly', 'one_time')),
  next_due_on date not null,
  memo text,
  active boolean not null default true,
  last_drafted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payables_user_due_idx
  on payables(user_id, active, next_due_on asc, updated_at desc);
