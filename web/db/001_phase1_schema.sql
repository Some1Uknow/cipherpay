CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_wallet_address text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL UNIQUE,
  wallet_label text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE auth_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  ip_hash text,
  user_agent_hash text,
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_nonces_wallet_idx ON auth_nonces(wallet_address);
CREATE INDEX auth_nonces_expires_idx ON auth_nonces(expires_at);

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  ip_hash text,
  user_agent_hash text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_wallet_idx ON sessions(wallet_address);
CREATE INDEX sessions_expires_idx ON sessions(expires_at);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  default_currency text NOT NULL,
  default_token_mint text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'finance_admin', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE treasuries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  wallet_address text NOT NULL,
  token_mint text NOT NULL,
  network text NOT NULL,
  label text NOT NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  wallet_address text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX recipients_org_idx ON recipients(organization_id);
CREATE INDEX recipients_wallet_idx ON recipients(wallet_address);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES recipients(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  amount_display numeric(20, 9) NOT NULL,
  amount_atomic bigint NOT NULL CHECK (amount_atomic > 0),
  currency text NOT NULL,
  token_mint text NOT NULL,
  due_at timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'queued', 'paid', 'failed', 'cancelled')),
  memo_ciphertext text NOT NULL,
  memo_nonce text NOT NULL,
  reference_ciphertext text,
  reference_nonce text,
  invoice_hash text NOT NULL UNIQUE,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, invoice_number)
);

CREATE INDEX invoices_org_status_idx ON invoices(organization_id, status);
CREATE INDEX invoices_due_idx ON invoices(due_at);

CREATE TABLE invoice_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  uploaded_by_user_id uuid NOT NULL REFERENCES users(id),
  file_name text NOT NULL,
  total_rows integer NOT NULL CHECK (total_rows >= 0),
  valid_rows integer NOT NULL CHECK (valid_rows >= 0),
  invalid_rows integer NOT NULL CHECK (invalid_rows >= 0),
  status text NOT NULL CHECK (status IN ('validated', 'committed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE invoice_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES invoice_imports(id) ON DELETE CASCADE,
  row_number integer NOT NULL CHECK (row_number > 0),
  raw_json jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('valid', 'invalid', 'committed')),
  error_message text,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL
);

CREATE INDEX invoice_import_rows_import_idx ON invoice_import_rows(import_id);

CREATE TABLE payout_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  treasury_id uuid NOT NULL REFERENCES treasuries(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('draft', 'submitting', 'partially_settled', 'settled', 'failed')),
  total_atomic bigint NOT NULL CHECK (total_atomic > 0),
  item_count integer NOT NULL CHECK (item_count > 0),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  executed_at timestamptz
);

CREATE INDEX payout_batches_org_idx ON payout_batches(organization_id);

CREATE TABLE payout_batch_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES payout_batches(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE RESTRICT,
  recipient_wallet_address text NOT NULL,
  amount_atomic bigint NOT NULL CHECK (amount_atomic > 0),
  status text NOT NULL CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed_retryable', 'failed_terminal')),
  tx_signature text,
  receipt_address text,
  error_message text
);

CREATE INDEX payout_batch_items_batch_idx ON payout_batch_items(batch_id);
