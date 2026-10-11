-- Data hub: one place for what a workspace's own systems hold. Additive.
--   Five data connectors (openapi, database, csv_import, imap, telegram_user) write rows into data_records, one row per
--   (connection, entity, external id), so a re-sync updates instead of duplicating. Agents read the hub through their grant
--   (agent_connections, purpose data_source / tool). Every sync is recorded in data_sync_runs.
--   connections gains its sync schedule (sync_every_minutes; null = manual only) and the last/next sync times.

alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check check (provider in (
  'telegram', 'sepay', 'zalo_oa', 'payos', 'casso', 'webhook', 'google', 'smtp',
  'openapi', 'database', 'csv_import', 'imap', 'telegram_user'
));

alter table public.connections
  add column if not exists sync_every_minutes int check (sync_every_minutes is null or sync_every_minutes between 5 and 10080),
  add column if not exists last_sync_at timestamptz,
  add column if not exists next_sync_at timestamptz;
create index if not exists connections_next_sync on public.connections (next_sync_at) where next_sync_at is not null and status <> 'disconnected';

create table if not exists public.data_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  entity text not null check (entity in ('customer', 'order', 'product', 'transaction', 'message', 'document', 'other')),
  external_id text not null,                 -- the source's own id (row key, API id, file row number, message id)
  title text not null default '',            -- one human line (a name, an order number, a subject)
  occurred_at timestamptz,                   -- when it happened at the source, when known
  data jsonb not null default '{}'::jsonb,   -- the mapped fields
  synced_at timestamptz not null default now(),
  unique (connection_id, entity, external_id)
);
create index if not exists data_records_ws_entity on public.data_records (workspace_id, entity, occurred_at desc nulls last);
create index if not exists data_records_title on public.data_records using gin (to_tsvector('simple', title));
alter table public.data_records enable row level security;
create policy data_records_read on public.data_records for select to authenticated using (public.is_manager(workspace_id));

create table if not exists public.data_sync_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'failed')),
  rows_upserted int not null default 0,
  error text,
  trigger text not null default 'schedule' check (trigger in ('schedule', 'manual', 'upload', 'push'))
);
create index if not exists data_sync_runs_conn_time on public.data_sync_runs (connection_id, started_at desc);
alter table public.data_sync_runs enable row level security;
create policy data_sync_runs_read on public.data_sync_runs for select to authenticated using (public.is_manager(workspace_id));
