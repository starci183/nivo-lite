-- The tables and the role the lite back end (be/) platform modules own: the app_be connection, the queue outbox that pairs
-- every pgmq send with the business transaction, and the fenced jobs. Written idempotently: a dev stack may already hold them.
-- On a hosted project the owner sets the app_be password (alter role app_be password '...') once; the migration never carries one.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'app_be') then
        create role app_be login noinherit;
    end if;
end
$$;

create extension if not exists pgmq;

grant usage on schema public to app_be;
grant usage on schema pgmq to app_be;
grant execute on all functions in schema pgmq to app_be;
grant select on table pgmq.meta to app_be;
grant usage, select on all sequences in schema pgmq to app_be;

create table if not exists public.queue (
    id uuid primary key default gen_random_uuid(),
    queue varchar(200) not null,
    payload jsonb not null,
    created_at timestamptz not null,
    sent_at timestamptz
);

create index if not exists queue_unsent_idx on public.queue (created_at, id) where sent_at is null;

alter table public.queue enable row level security;

drop policy if exists "queue_app_be_select" on public.queue;
create policy "queue_app_be_select" on public.queue for select to app_be using (queue is not null);
drop policy if exists "queue_app_be_insert" on public.queue;
create policy "queue_app_be_insert" on public.queue for insert to app_be with check (queue is not null);
drop policy if exists "queue_app_be_update" on public.queue;
create policy "queue_app_be_update" on public.queue for update to app_be using (queue is not null) with check (queue is not null);

revoke all on table public.queue from public, anon, authenticated;
grant select, insert, update on table public.queue to app_be;

create table if not exists public.jobs (
    id uuid primary key default gen_random_uuid(),
    kind varchar(200) not null,
    job_key varchar(200) not null,
    status varchar(16) not null,
    current_step varchar(200),
    fencing_token bigint not null,
    claimed_by varchar(200),
    lease_expires_at timestamptz,
    payload jsonb not null,
    error text,
    created_at timestamptz not null,
    updated_at timestamptz not null,
    constraint jobs_job_key_key unique (job_key),
    constraint jobs_status_check check (status in ('running', 'failed', 'done')),
    constraint jobs_fencing_token_check check (fencing_token >= 1)
);

alter table public.jobs enable row level security;

drop policy if exists "jobs_app_be_select" on public.jobs;
create policy "jobs_app_be_select" on public.jobs for select to app_be using (kind is not null);
drop policy if exists "jobs_app_be_insert" on public.jobs;
create policy "jobs_app_be_insert" on public.jobs for insert to app_be with check (kind is not null);
drop policy if exists "jobs_app_be_update" on public.jobs;
create policy "jobs_app_be_update" on public.jobs for update to app_be using (kind is not null) with check (kind is not null);

revoke all on table public.jobs from public, anon, authenticated;
grant select, insert, update on table public.jobs to app_be;
