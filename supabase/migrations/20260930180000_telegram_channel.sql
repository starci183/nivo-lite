-- Real customer channels beyond the website chat: a conversation remembers where it lives (website | telegram)
-- and the channel's own id (Telegram chat id), so replies can be delivered back to the customer. Additive only.
alter table public.agent_conversations add column if not exists channel text not null default 'website';
alter table public.agent_conversations add column if not exists external_id text;
create unique index if not exists agent_conversations_channel_external
  on public.agent_conversations (workspace_id, channel, external_id) where external_id is not null;

-- Telegram is a real inbound channel (live), next to the website chat.
alter table public.inbound_events drop constraint if exists inbound_events_channel_check;
alter table public.inbound_events add constraint inbound_events_channel_check
  check (channel in ('website', 'telegram', 'facebook', 'zalo', 'email', 'phone', 'bank', 'manual'));
