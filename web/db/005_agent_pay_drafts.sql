alter table payout_runs
  add column if not exists source text not null default 'app';

alter table payout_runs
  drop constraint if exists payout_runs_source_check;

update payout_runs
set source = 'app'
where source is null or source not in ('app', 'payables');

alter table payout_runs
  add constraint payout_runs_source_check
  check (source in ('app', 'payables'));

create index if not exists payout_runs_source_status_idx
  on payout_runs(user_id, source, status, last_interacted_at desc);
