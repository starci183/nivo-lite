-- The shared realtime hub of a deploy that runs several api replicas (platform/realtime, REALTIME_HUB=postgres).
-- realtime_events is the bounded replay table: a reconnecting SSE client sends Last-Event-ID to ANY replica and the hub reads
-- the frames it missed here. The Redis hub (the default while Redis is declared) keeps its replay in a Redis Stream and leaves this
-- table empty. Only the app_be connection reaches the table.
create table public.realtime_events (
    seq bigint generated always as identity primary key,
    topic text not null check (length(topic) <= 256),
    event_id text,
    payload jsonb not null,
    created_at timestamptz not null default now()
);

create index realtime_events_topic_seq_idx on public.realtime_events (topic, seq desc);
create index realtime_events_event_idx on public.realtime_events (topic, event_id, seq desc) where event_id is not null;
create index realtime_events_created_at_idx on public.realtime_events (created_at);

alter table public.realtime_events enable row level security;
alter table public.realtime_events force row level security;

create policy realtime_events_app_be_select
on public.realtime_events for select to app_be
using (topic is not null);

create policy realtime_events_app_be_insert
on public.realtime_events for insert to app_be
with check (topic is not null);

create policy realtime_events_app_be_delete
on public.realtime_events for delete to app_be
using (topic is not null);

revoke all on table public.realtime_events from public, anon, authenticated;
grant select, insert, delete on table public.realtime_events to app_be;

-- The retention sweep that keeps realtime_events bounded: a BullMQ queue (realtime_retention) fed by the job outbox, ticked every
-- minute by pg_cron. The tick only enqueues one outbox row; the delete belongs to the sweep-realtime-events job the runner claims.
-- `cli jobs tick realtime-retention-tick` sends the same tick by hand.
