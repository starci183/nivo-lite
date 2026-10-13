-- NIVO OS prototype: one customer journey
-- Lead -> Context -> Responsibility (owner + next action) -> Human x AI execution -> Outcome / Evidence / History

create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- An agent is an installed module (NIVO catalog: chatbot | sales | accounting; only chatbot is installable in this build)
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  module text not null default 'chatbot' check (module in ('chatbot', 'sales', 'accounting')),
  name text not null,
  handle text not null,
  role text not null,
  instructions text not null,
  knowledge text not null default '',
  greeting text not null default '',
  approval_rule text not null default 'Anything that commits price, schedule or scope needs human approval.',
  status text not null default 'active' check (status in ('active', 'paused')),
  created_at timestamptz not null default now(),
  unique (workspace_id, handle)
);

-- 1:1 conversations with an agent: 'test' (owner tries the agent) or 'customer' (simulated customer channel)
create table public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  agent_id uuid not null references public.agents (id) on delete cascade,
  kind text not null check (kind in ('test', 'customer')),
  visitor_name text,
  lead_id uuid,
  created_at timestamptz not null default now()
);

create table public.agent_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null references public.agent_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'agent', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_name text not null,
  company text not null,
  channel text not null,
  need text not null,
  stage text not null default 'new' check (stage in ('new', 'qualified', 'proposal', 'won', 'lost')),
  context_summary text,
  created_at timestamptz not null default now()
);

create table public.responsibilities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid not null references public.leads (id) on delete cascade,
  title text not null,
  owner_kind text not null check (owner_kind in ('human', 'agent')),
  owner_agent_id uuid references public.agents (id) on delete set null,
  owner_name text not null,
  next_action text not null,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open', 'waiting_approval', 'done')),
  created_at timestamptz not null default now()
);

create table public.executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  responsibility_id uuid not null references public.responsibilities (id) on delete cascade,
  agent_id uuid references public.agents (id) on delete set null,
  kind text not null default 'follow_up',
  draft text not null,
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  author_kind text not null check (author_kind in ('human', 'agent', 'system')),
  author_name text not null,
  agent_id uuid references public.agents (id) on delete set null,
  body text not null,
  lead_id uuid references public.leads (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only history: the audit trail and outcome evidence
create table public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete cascade,
  kind text not null,
  actor text not null,
  summary text not null,
  evidence text,
  created_at timestamptz not null default now()
);

create index on public.agents (workspace_id);
create index on public.agent_conversations (agent_id);
create index on public.agent_messages (conversation_id, created_at);
create index on public.leads (workspace_id, created_at desc);
create index on public.responsibilities (workspace_id, status);
create index on public.responsibilities (lead_id);
create index on public.executions (responsibility_id);
create index on public.messages (workspace_id, created_at);
create index on public.events (lead_id, created_at);

create or replace function public.owns_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.workspaces w where w.id = ws and w.owner_id = auth.uid());
$$;

alter table public.workspaces enable row level security;
alter table public.agents enable row level security;
alter table public.leads enable row level security;
alter table public.responsibilities enable row level security;
alter table public.executions enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.agent_conversations enable row level security;
alter table public.agent_messages enable row level security;

create policy workspaces_owner on public.workspaces
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy agents_owner on public.agents
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy leads_owner on public.leads
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy responsibilities_owner on public.responsibilities
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy executions_owner on public.executions
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy messages_owner on public.messages
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));

create policy agent_conversations_owner on public.agent_conversations
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));
create policy agent_messages_owner on public.agent_messages
  for all using (public.owns_workspace(workspace_id)) with check (public.owns_workspace(workspace_id));

-- events are append-only: no update/delete policy
create policy events_read on public.events
  for select using (public.owns_workspace(workspace_id));
create policy events_insert on public.events
  for insert with check (public.owns_workspace(workspace_id));

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.agent_messages;
