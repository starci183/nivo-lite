-- Agent access per connection, owner only. Additive.
--   agent_connections.access: what an agent may do through one connection.
--     read  : it sees what comes in (messages, payments, rows) but never answers or sends through it.
--     ask   : everything it would send through the connection waits for a person's approval.
--     auto  : it acts within the owner's rules on the Authority page (the behaviour before this migration).
--   Existing bindings keep working as before (auto); a new binding defaults to ask, and auto is never a default.
--   Purposes grow for the data connectors (data_source: rows the agent may read; tool: an API the agent may call).
--   Only the workspace owner may grant or revoke access (was owner or manager); every change is logged in agent_access_log.

create or replace function public.is_owner(ws uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.member_role(ws) = 'owner', false);
$$;

alter table public.agent_connections
  add column if not exists access text not null default 'ask' check (access in ('read', 'ask', 'auto'));
update public.agent_connections set access = 'auto';

alter table public.agent_connections drop constraint if exists agent_connections_purpose_check;
alter table public.agent_connections
  add constraint agent_connections_purpose_check
  check (purpose in ('inbound_chat', 'outbound_chat', 'bank_feed', 'data_source', 'tool'));

drop policy if exists agent_connections_write on public.agent_connections;
create policy agent_connections_write on public.agent_connections for all to authenticated
  using (public.is_owner(workspace_id)) with check (public.is_owner(workspace_id));

create table if not exists public.agent_access_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  agent_id uuid references public.agents (id) on delete set null,
  connection_name text not null default '',
  agent_name text not null default '',
  before_access text check (before_access is null or before_access in ('read', 'ask', 'auto')),   -- null = had no access
  after_access text check (after_access is null or after_access in ('read', 'ask', 'auto')),      -- null = access removed
  changed_by uuid,
  changed_by_name text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists agent_access_log_ws_time on public.agent_access_log (workspace_id, created_at desc);
alter table public.agent_access_log enable row level security;
-- Owners and managers read the trail; nobody writes it from the browser (the server writes it with the service role).
create policy agent_access_log_read on public.agent_access_log for select to authenticated using (public.is_manager(workspace_id));
