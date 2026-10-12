-- Office "@agent -> command": an owner or manager mentions ONE agent in the Office, NIVO reads the message into a command candidate (one metered
-- model call, usage kind 'office_command'), and the person confirms it in a card under their message. Commands stay the system of record
-- (agent-commands.ts sendCommand, from "owner", so the receiver's own gate still decides); the chat is only the human-facing mirror.
--
--   office_command_candidates   one row per parsed message: the module and command picked from that module's `accepts`, the payload NIVO filled
--                               (required fields from the text plus the customer / order it resolved), and where it stands:
--                               pending (card shown) -> sent (work_item_id set) | cancelled. A refused send keeps the row pending with refusal_detail.
--   ai_usage_events.kind        gains 'office_command' so the call is metered under its own kind.
-- Additive. Reads and the confirm / cancel writes: owners and managers (RLS); the row is created by the server action that parsed the message.

create table if not exists public.office_command_candidates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,   -- the owner's message the card sits under
  module text not null,                                                          -- the receiving module (agent) that was mentioned
  command text not null,                                                         -- one of that module's accepted commands
  payload jsonb not null default '{}'::jsonb,                                    -- contract keys: subject_id / lead_id / the module's other required fields
  summary text not null default '',                                              -- one line NIVO shows ("xuất phiếu thu cho đơn #DH-1")
  shown jsonb not null default '[]'::jsonb,                                      -- the card rows, already labelled: [{ key, label, value }] (customer, order, other fields)
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  work_item_id uuid references public.work_items (id) on delete set null,        -- set when sent
  refusal_detail text,                                                           -- why the last send was refused (the card stays pending)
  created_by text not null default '',                                           -- member display name
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists office_command_candidates_message on public.office_command_candidates (message_id);
create index if not exists office_command_candidates_ws on public.office_command_candidates (workspace_id, created_at desc);
alter table public.office_command_candidates enable row level security;
create policy office_command_candidates_read on public.office_command_candidates for select to authenticated using (public.is_manager(workspace_id));
create policy office_command_candidates_write on public.office_command_candidates for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
alter publication supabase_realtime add table public.office_command_candidates;

alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_kind_check
  check (kind in ('chat_reply', 'setup', 'owner_chat', 'relay', 'embedding', 'engine', 'guide', 'brain', 'office_command'));
