-- Module foundation (additive). One installation per module per workspace, a private setup chat that ends in an
-- immutable context version, and the agent the module drives.
--   module_installations   status installing | setup | ready | live | paused, operating mode, live switch, active context version
--   module_setup_sessions  the draft being built in the setup chat (summary + facts) and the evidence per setup gate
--   module_setup_messages  the private owner <-> NIVO setup conversation (realtime)
--   module_context_versions  immutable applied snapshots ("Bản đang dùng" points at one of them)
-- RLS: members read installations and versions; owner | manager write them. Setup sessions and chat are owner | manager only.

create table public.module_installations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module_key text not null check (module_key in ('chatbot', 'sales', 'accounting')),
  agent_id uuid references public.agents (id) on delete set null,
  status text not null default 'installing' check (status in ('installing', 'setup', 'ready', 'live', 'paused')),
  operating_mode text not null default 'assist' check (operating_mode in ('assist', 'autopilot')),
  live_enabled boolean not null default false,
  active_context_version_id uuid,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, module_key)
);

create table public.module_setup_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  installation_id uuid not null references public.module_installations (id) on delete cascade,
  revision int not null default 1,
  status text not null default 'draft' check (status in ('draft', 'applied', 'discarded')),
  draft_snapshot jsonb not null default '{"summary": "", "facts": []}'::jsonb,
  gate_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (installation_id, revision)
);
create index module_setup_sessions_inst on public.module_setup_sessions (installation_id, revision desc);

create table public.module_setup_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  setup_session_id uuid not null references public.module_setup_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  author text not null default '',
  body text not null,
  created_at timestamptz not null default now()
);
create index module_setup_messages_session on public.module_setup_messages (setup_session_id, created_at);

create table public.module_context_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  installation_id uuid not null references public.module_installations (id) on delete cascade,
  version int not null,
  snapshot jsonb not null,
  applied_by text not null default '',
  applied_at timestamptz not null default now(),
  unique (installation_id, version)
);

alter table public.module_installations
  add constraint module_installations_active_version_fk
  foreign key (active_context_version_id) references public.module_context_versions (id) on delete set null;

-- Context versions are immutable: no update, no delete (except with the whole installation).
create or replace function public.module_context_versions_immutable()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then raise exception 'context_version_immutable' using errcode = 'P0001'; end if;
  return old;
end;
$$;
create trigger module_context_versions_immutable before update on public.module_context_versions
  for each row execute function public.module_context_versions_immutable();

-- ---------------------------------------------------------------- RLS
alter table public.module_installations enable row level security;
alter table public.module_setup_sessions enable row level security;
alter table public.module_setup_messages enable row level security;
alter table public.module_context_versions enable row level security;

create policy module_installations_read on public.module_installations for select using (public.is_member(workspace_id));
create policy module_installations_insert on public.module_installations for insert with check (public.is_manager(workspace_id));
create policy module_installations_update on public.module_installations for update
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy module_installations_delete on public.module_installations for delete using (public.is_manager(workspace_id));

create policy module_context_versions_read on public.module_context_versions for select using (public.is_member(workspace_id));
create policy module_context_versions_insert on public.module_context_versions for insert with check (public.is_manager(workspace_id));

create policy module_setup_sessions_all on public.module_setup_sessions for all
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
create policy module_setup_messages_all on public.module_setup_messages for all
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

alter publication supabase_realtime add table public.module_setup_messages;
