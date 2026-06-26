create table if not exists agent_private_utxos (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  amount_base_units numeric(38, 0) not null,
  asset_symbol text not null default 'SOL',
  asset_decimals integer not null default 9,
  deposit_signature text not null unique,
  deposit_commitment text,
  serialized_utxo_ciphertext text not null,
  status text not null default 'active' check (status in ('active', 'spent', 'void')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_private_utxos_agent_status_idx
  on agent_private_utxos(agent_id, status, created_at desc);
