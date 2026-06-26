delete from payout_run_items
where run_id in (select id from payout_runs where source = 'mcp');

delete from payout_runs
where source = 'mcp';

alter table payout_runs
  drop constraint if exists payout_runs_source_check;

update payout_runs
set source = 'app'
where source is null or source not in ('app', 'payables');

alter table payout_runs
  add constraint payout_runs_source_check
  check (source in ('app', 'payables'));

drop index if exists payout_runs_source_status_idx;
create index if not exists payout_runs_source_status_idx
  on payout_runs(user_id, source, status, last_interacted_at desc);

create table if not exists agent_link_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  owner_wallet_address text not null,
  code_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_link_codes_user_recent_idx
  on agent_link_codes(user_id, created_at desc);

create table if not exists agent_link_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  link_code_id uuid not null references agent_link_codes(id) on delete cascade,
  proposed_handle text not null,
  proposed_name text not null,
  agent_wallet_address text not null,
  agent_viewing_public_key text,
  encrypted_viewing_key text,
  backup_attested_at timestamptz,
  pending_pat_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_link_requests_user_status_idx
  on agent_link_requests(user_id, status, created_at desc);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  owner_wallet_address text not null,
  handle text not null unique,
  display_name text not null,
  agent_wallet_address text not null unique,
  agent_viewing_public_key text,
  encrypted_viewing_key text,
  shielded_balance_base_units numeric(38, 0) not null default 0,
  asset_symbol text not null default 'SOL',
  asset_decimals integer not null default 9,
  policy_mode text not null default 'approval_required' check (policy_mode in ('approval_required', 'autonomous')),
  per_tx_limit_base_units numeric(38, 0),
  rolling_24h_limit_base_units numeric(38, 0),
  public_withdrawals_enabled boolean not null default false,
  status text not null default 'active' check (status in ('active', 'revoked', 'archived')),
  linked_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agents_user_status_idx
  on agents(user_id, status, linked_at desc);

create table if not exists agent_credentials (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  token_hash text not null unique,
  label text not null default 'default',
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists agent_funding_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  requested_amount_base_units numeric(38, 0),
  requested_amount_input text,
  note_ciphertext text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed', 'funded', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists agent_approval_requests (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  kind text not null check (kind in ('payment', 'invoice_payment', 'public_withdrawal', 'policy_change')),
  amount_base_units numeric(38, 0),
  fee_base_units numeric(38, 0),
  target text,
  metadata_ciphertext text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired', 'executed')),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_approval_requests_user_status_idx
  on agent_approval_requests(user_id, status, created_at desc);

create table if not exists agent_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  issuer_agent_id uuid not null references agents(id) on delete cascade,
  issuer_user_id uuid not null references users(id) on delete cascade,
  recipient_agent_id uuid references agents(id) on delete set null,
  recipient_handle text,
  human_payment_slug text unique,
  payer_wallet_address text,
  amount_base_units numeric(38, 0) not null,
  amount_input text not null,
  asset_symbol text not null default 'SOL',
  asset_decimals integer not null default 9,
  encrypted_title text not null,
  encrypted_description text,
  encrypted_external_ref text,
  encrypted_human_contact text,
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled', 'dismissed')),
  due_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_invoices_issuer_recent_idx
  on agent_invoices(issuer_user_id, created_at desc);
create index if not exists agent_invoices_recipient_status_idx
  on agent_invoices(recipient_agent_id, status, created_at desc);

create table if not exists agent_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_agent_id uuid not null references agents(id) on delete cascade,
  blocked_agent_id uuid not null references agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_agent_id, blocked_agent_id)
);

create table if not exists agent_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  agent_id uuid references agents(id) on delete set null,
  event_type text not null,
  amount_base_units numeric(38, 0),
  asset_symbol text not null default 'SOL',
  counterparty text,
  status text not null default 'recorded',
  metadata_ciphertext text,
  created_at timestamptz not null default now()
);

create index if not exists agent_activity_user_recent_idx
  on agent_activity(user_id, created_at desc);
