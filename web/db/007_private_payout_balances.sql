alter table payout_runs
  add column if not exists private_balance_before numeric(40, 0),
  add column if not exists private_balance_after numeric(40, 0);
