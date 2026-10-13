-- Channels and inbox on the lite back end: the durable inboxes of the Telegram and Zalo webhooks (one row per delivery, the claim that makes
-- a redelivery a no-op), and the reply link that lets the back end store the agent's answer to one customer message exactly once.
-- The tables the channels reach otherwise (connections, connection_secrets, agent_conversations, agent_messages, channel_receipts,
-- inbound_events, agents, agent_connections, module_installations) are granted to app_be by 20261012130100_app-be-grants.

create table public.telegram_inbox (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = 'telegram'),
    delivery_id text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed_at timestamptz,
    constraint telegram_inbox_provider_delivery_id_key unique (provider, delivery_id)
);

alter table public.telegram_inbox enable row level security;

-- The dedicated app_be PostgreSQL role is the only application path. With no anon or authenticated policy,
-- RLS denies those PostgREST roles by default.
create policy "telegram_inbox_app_be_select"
on public.telegram_inbox for select to app_be
using (provider = 'telegram');

create policy "telegram_inbox_app_be_insert"
on public.telegram_inbox for insert to app_be
with check (provider = 'telegram');

create policy "telegram_inbox_app_be_update"
on public.telegram_inbox for update to app_be
using (provider = 'telegram')
with check (provider = 'telegram');

revoke all on table public.telegram_inbox from public, anon, authenticated;
grant select, insert, update on table public.telegram_inbox to app_be;

create table public.zalo_inbox (
    id uuid primary key default gen_random_uuid(),
    provider text not null check (provider = 'zalo'),
    delivery_id text not null,
    received_at timestamptz not null default now(),
    payload jsonb not null,
    processed_at timestamptz,
    constraint zalo_inbox_provider_delivery_id_key unique (provider, delivery_id)
);

alter table public.zalo_inbox enable row level security;

create policy "zalo_inbox_app_be_select"
on public.zalo_inbox for select to app_be
using (provider = 'zalo');

create policy "zalo_inbox_app_be_insert"
on public.zalo_inbox for insert to app_be
with check (provider = 'zalo');

create policy "zalo_inbox_app_be_update"
on public.zalo_inbox for update to app_be
using (provider = 'zalo')
with check (provider = 'zalo');

revoke all on table public.zalo_inbox from public, anon, authenticated;
grant select, insert, update on table public.zalo_inbox to app_be;

-- The customer message an agent reply answers: one agent reply per customer message, so a redelivered job stores nothing twice.
alter table public.agent_messages add column in_reply_to uuid references public.agent_messages (id) on delete set null;

create unique index agent_messages_one_reply_per_message_key
on public.agent_messages (conversation_id, in_reply_to)
where role = 'agent' and in_reply_to is not null;
