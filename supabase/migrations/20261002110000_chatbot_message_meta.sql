-- Chatbot workbench: who wrote a reply and whether it reached the customer channel (additive, nullable).
alter table public.agent_messages add column if not exists author_kind text check (author_kind in ('ai', 'human'));
alter table public.agent_messages add column if not exists author_name text;
alter table public.agent_messages add column if not exists delivery_status text check (delivery_status in ('sent', 'failed'));
create index if not exists agent_messages_ws_created on public.agent_messages (workspace_id, created_at desc);
