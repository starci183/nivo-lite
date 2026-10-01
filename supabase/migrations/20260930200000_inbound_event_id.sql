-- Idempotency by channel EVENT ID (not by content/day). Additive only.
-- 1. Every inbound event can carry the channel's own event id (Telegram `tg:<chat_id>:<message_id>`, a simulator
--    "event code", a website-chat agent_message id). When present, dedupe_key = channel:kind:event_id, so the same event
--    redelivered is blocked on any day, while a new event with identical text is a new input.
--    external_ref stays the business reference (order code, bank reference).
alter table public.inbound_events add column if not exists event_id text;
create index if not exists inbound_ws_event_id on public.inbound_events (workspace_id, event_id) where event_id is not null;

-- 2. Webhook delivery receipts: a channel's retried delivery (Telegram re-sends the same update_id) is processed once.
--    Written only by the service-role webhook; no client policies.
create table if not exists public.channel_receipts (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel text not null,
  receipt_id text not null,            -- e.g. 'update:<telegram update_id>'
  created_at timestamptz not null default now(),
  primary key (workspace_id, channel, receipt_id)
);
alter table public.channel_receipts enable row level security;
