-- The lite back end (be/) public API: the api_keys table of its key capability, the request ledger of its public-api capability and
-- the app_be access to the tables they use.
--   public.api_keys       was workspace_api_keys: a table is named for the capability that owns it. Rows, indexes and the
--                         rate limit foreign key follow the rename; the key authentication function is re-created over the new name.
--   public.public_api     one row per request the public API accepted (a customer, a message, a knowledge source): the body waits
--                         here for the job that carries it out, and the unique dedupe key makes a repeat one request.
--   public_api queue      the pgmq queue the ledger rows travel on.
--   app_be grants         api_keys (admission, key management), the tables the API only reads, and the authentication function.
-- Forward only. Policies are named <table>_<role>_<action>; each policy is dropped first so the file may run twice.

do $$
begin
    if to_regclass('public.workspace_api_keys') is not null and to_regclass('public.api_keys') is null then
        alter table public.workspace_api_keys rename to api_keys;
    end if;
end
$$;

alter index if exists public.workspace_api_keys_pkey rename to api_keys_pkey;
alter index if exists public.workspace_api_keys_key_hash_key rename to api_keys_key_hash_key;
alter index if exists public.workspace_api_keys_workspace rename to api_keys_workspace;

-- One round trip verifies a key, counts its minute and stamps its last use; null for an unknown key, {"revoked": true} for a revoked one.
create or replace function public.api_key_auth(p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare k public.api_keys; v_hits int;
begin
  select * into k from public.api_keys where key_hash = p_hash;
  if not found then return null; end if;
  if k.revoked_at is not null then return jsonb_build_object('revoked', true); end if;
  v_hits := public.api_rate_hit(k.id);
  -- informational, so at most one write a minute per key
  if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = k.id;
  end if;
  return jsonb_build_object('id', k.id, 'workspace_id', k.workspace_id, 'name', k.name, 'scopes', to_jsonb(k.scopes), 'hits', v_hits);
end $$;
revoke execute on function public.api_key_auth(text) from public, anon, authenticated;
grant execute on function public.api_key_auth(text) to app_be;

-- The queue that carries accepted requests to their jobs.
select pgmq.create('public_api');

create table if not exists public.public_api (
    id uuid primary key default gen_random_uuid(),
    workspace_id uuid not null references public.workspaces (id) on delete cascade,
    key_id uuid not null references public.api_keys (id) on delete cascade,
    kind text not null check (kind in ('lead', 'message', 'knowledge')),
    dedupe_key text not null,
    payload jsonb not null,
    lead_id uuid references public.leads (id) on delete set null,
    duplicates int not null default 0 check (duplicates >= 0),
    created_at timestamptz not null default now(),
    processed_at timestamptz,
    constraint public_api_dedupe_key unique (workspace_id, dedupe_key)
);

create index if not exists public_api_unprocessed on public.public_api (created_at) where processed_at is null;

alter table public.public_api enable row level security;

drop policy if exists "public_api_app_be_select" on public.public_api;
create policy "public_api_app_be_select" on public.public_api for select to app_be using (workspace_id is not null);
drop policy if exists "public_api_app_be_insert" on public.public_api;
create policy "public_api_app_be_insert" on public.public_api for insert to app_be with check (workspace_id is not null);
drop policy if exists "public_api_app_be_update" on public.public_api;
create policy "public_api_app_be_update" on public.public_api for update to app_be
    using (workspace_id is not null) with check (workspace_id is not null);

revoke all on table public.public_api from public, anon, authenticated;
grant select, insert, update on table public.public_api to app_be;

-- api_keys: the key list of a manager, a new key and a revocation.
drop policy if exists "api_keys_app_be_select" on public.api_keys;
create policy "api_keys_app_be_select" on public.api_keys for select to app_be using (workspace_id is not null);
drop policy if exists "api_keys_app_be_insert" on public.api_keys;
create policy "api_keys_app_be_insert" on public.api_keys for insert to app_be with check (workspace_id is not null);
drop policy if exists "api_keys_app_be_update" on public.api_keys;
create policy "api_keys_app_be_update" on public.api_keys for update to app_be
    using (workspace_id is not null) with check (workspace_id is not null);

revoke all on table public.api_keys from public, anon, authenticated;
grant select, insert, update on table public.api_keys to app_be;

-- The tables the public API reads for the workspace of a key, and the membership that decides who manages the keys.
drop policy if exists "leads_app_be_select" on public.leads;
create policy "leads_app_be_select" on public.leads for select to app_be using (workspace_id is not null);
grant select on table public.leads to app_be;

drop policy if exists "events_app_be_select" on public.events;
create policy "events_app_be_select" on public.events for select to app_be using (workspace_id is not null);
grant select on table public.events to app_be;

drop policy if exists "agent_conversations_app_be_select" on public.agent_conversations;
create policy "agent_conversations_app_be_select" on public.agent_conversations for select to app_be using (workspace_id is not null);
grant select on table public.agent_conversations to app_be;

drop policy if exists "workspace_members_app_be_select" on public.workspace_members;
create policy "workspace_members_app_be_select" on public.workspace_members for select to app_be using (workspace_id is not null);
grant select on table public.workspace_members to app_be;
