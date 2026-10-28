-- Integrations are per workspace and self-configured by its owner/manager. A workspace can hold MANY connections of each provider
-- (e.g. two Telegram bots, two bank accounts) and each AGENT picks which connections it uses (agent_connections).
--   connections        non-secret facts, readable by members (public_meta: bot_username, masked account, OA name...)
--   connection_secrets encrypted credential + the webhook secret; RLS on with NO policy and no grants: service role only.
-- Credentials are AES-256-GCM encrypted in app code (env CHANNEL_TOKEN_KEY); the database never sees plaintext.
-- Writes to connections/secrets happen only in server actions (service role) after requireRole owner|manager.
create table public.connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('telegram', 'sepay', 'zalo_oa')),
  name text not null,
  public_meta jsonb not null default '{}'::jsonb,
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  last_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index connections_workspace on public.connections (workspace_id, provider);
-- One Telegram bot has one webhook: a live bot can belong to only one connection (and so one workspace).
create unique index connections_telegram_bot on public.connections ((public_meta ->> 'bot_id')) where provider = 'telegram' and status <> 'disconnected';
alter table public.connections enable row level security;
create policy connections_read on public.connections for select to authenticated using (public.is_member(workspace_id));

create table public.connection_secrets (
  connection_id uuid primary key references public.connections (id) on delete cascade,
  ciphertext text not null,
  webhook_secret text not null
);
alter table public.connection_secrets enable row level security;
revoke all on public.connection_secrets from anon, authenticated;

-- Which connections an agent uses, and for what.
create table public.agent_connections (
  agent_id uuid not null references public.agents (id) on delete cascade,
  connection_id uuid not null references public.connections (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  purpose text not null default 'inbound_chat' check (purpose in ('inbound_chat', 'outbound_chat', 'bank_feed')),
  created_at timestamptz not null default now(),
  primary key (agent_id, connection_id)
);
create index agent_connections_connection on public.agent_connections (connection_id);
alter table public.agent_connections enable row level security;
create policy agent_connections_read on public.agent_connections for select to authenticated using (public.is_member(workspace_id));
create policy agent_connections_write on public.agent_connections for all to authenticated
  using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

-- An agent and a connection can only be bound inside their own workspace.
create function public.agent_connections_same_workspace() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.workspace_id = new.workspace_id)
     or not exists (select 1 from public.connections c where c.id = new.connection_id and c.workspace_id = new.workspace_id) then
    raise exception 'agent and connection must belong to the same workspace';
  end if;
  return new;
end $$;
create trigger agent_connections_same_workspace before insert or update on public.agent_connections
  for each row execute function public.agent_connections_same_workspace();

-- A conversation remembers the connection it came in on, so replies go back through the same bot. Null = the legacy env bot / website.
alter table public.agent_conversations add column connection_id uuid references public.connections (id) on delete set null;
drop index if exists public.agent_conversations_channel_external;
create unique index agent_conversations_channel_external
  on public.agent_conversations (workspace_id, channel, coalesce(connection_id, '00000000-0000-0000-0000-000000000000'::uuid), external_id) where external_id is not null;
