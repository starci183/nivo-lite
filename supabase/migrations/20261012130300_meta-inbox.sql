-- The signed Meta webhook delivery is claimed once in meta_inbox (the provider inbox of the webhooks pattern) and its events are
-- queued on the meta_inbound queue in the same transaction. Written through the app_be connection only.
create extension if not exists pgmq;

select pgmq.create('meta_inbound');

create table if not exists public.meta_inbox (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = 'meta'),
    delivery_id text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed_at timestamptz,
    constraint meta_inbox_provider_delivery_id_key unique (provider, delivery_id)
);

alter table public.meta_inbox enable row level security;

drop policy if exists "meta_inbox_app_be_select" on public.meta_inbox;
create policy "meta_inbox_app_be_select" on public.meta_inbox for select to app_be using (provider = 'meta');

drop policy if exists "meta_inbox_app_be_insert" on public.meta_inbox;
create policy "meta_inbox_app_be_insert" on public.meta_inbox for insert to app_be with check (provider = 'meta');

drop policy if exists "meta_inbox_app_be_update" on public.meta_inbox;
create policy "meta_inbox_app_be_update" on public.meta_inbox for update to app_be using (provider = 'meta') with check (provider = 'meta');

revoke all on table public.meta_inbox from public, anon, authenticated;
grant select, insert, update on table public.meta_inbox to app_be;

-- The queue tables of pgmq are reached by app_be through its pgmq grants (be-platform migration).
grant select, insert, update, delete on table pgmq.q_meta_inbound to app_be;
grant select, insert, update, delete on table pgmq.a_meta_inbound to app_be;
