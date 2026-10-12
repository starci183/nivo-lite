-- The lite back end (be/) public API: the api_keys table of its key capability, the request ledger of its public-api capability and
-- the app_be access to the tables they use.
--   public.api_keys       was workspace_api_keys: a table is named for the capability that owns it. Rows, indexes and the
--                         rate limit foreign key follow the rename; the key authentication function is re-created over the new name.
--   public.public_api     one row per request the public API accepted (a customer, a message, a knowledge source): the body waits
--                         here for the job that carries it out, and the unique dedupe key makes a repeat one request.
--   public_api queue      the pgmq queue the ledger rows travel on.
--   key management        api_key_create / api_key_revoke for the managers of a workspace, a column-limited select that hides key_hash.
--   app_be grants         the tables the API only reads and the authentication function.
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

-- api_keys: the back end reaches it only through api_key_auth. A workspace manager lists the keys of the workspace (never the hash:
-- the column grant leaves key_hash out) and creates or revokes one through the two functions below.
drop policy if exists "api_keys_authenticated_select" on public.api_keys;
create policy "api_keys_authenticated_select" on public.api_keys for select to authenticated using (public.is_manager(workspace_id));

revoke all on table public.api_keys from public, anon, authenticated;
grant select (id, workspace_id, name, key_prefix, scopes, created_at, last_used_at, revoked_at) on table public.api_keys to authenticated;

-- Creates a key for a workspace the caller manages. The secret is built and hashed here and answered once; only its hash is stored.
create or replace function public.api_key_create(p_workspace uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60);
  v_key text;
  v_row public.api_keys;
  v_actor text;
begin
  if not public.is_manager(p_workspace) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_name) < 2 then raise exception 'name too short' using errcode = '22023'; end if;
  if (select count(*) from public.api_keys where workspace_id = p_workspace and revoked_at is null) >= 20 then
    raise exception 'too many active keys' using errcode = '23514';
  end if;
  v_key := 'nvk_' || translate(trim(trailing '=' from encode(gen_random_bytes(32), 'base64')), '+/', '-_');
  insert into public.api_keys (workspace_id, name, key_prefix, key_hash, created_by)
  values (p_workspace, v_name, left(v_key, 12), encode(digest(v_key, 'sha256'), 'hex'), auth.uid())
  returning * into v_row;
  select m.display_name into v_actor from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = auth.uid();
  insert into public.events (workspace_id, kind, actor, summary, evidence)
  values (p_workspace, 'api.key_created', coalesce(v_actor, ''), 'API key created: ' || v_name, v_row.key_prefix);
  return jsonb_build_object(
    'key', v_key,
    'item', jsonb_build_object('id', v_row.id, 'name', v_row.name, 'prefix', v_row.key_prefix, 'createdAt', v_row.created_at, 'lastUsedAt', null, 'revokedAt', null)
  );
end $$;
revoke execute on function public.api_key_create(uuid, text) from public, anon;
grant execute on function public.api_key_create(uuid, text) to authenticated;

-- Revokes a working key of a workspace the caller manages: it stops working at once and its row stays as history.
create or replace function public.api_key_revoke(p_workspace uuid, p_key uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row public.api_keys;
  v_actor text;
begin
  if not public.is_manager(p_workspace) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.api_keys set revoked_at = now()
  where id = p_key and workspace_id = p_workspace and revoked_at is null
  returning * into v_row;
  if not found then raise exception 'key not found' using errcode = '22023'; end if;
  select m.display_name into v_actor from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = auth.uid();
  insert into public.events (workspace_id, kind, actor, summary, evidence)
  values (p_workspace, 'api.key_revoked', coalesce(v_actor, ''), 'API key revoked: ' || v_row.name, v_row.key_prefix);
  return jsonb_build_object(
    'id', v_row.id, 'name', v_row.name, 'prefix', v_row.key_prefix, 'createdAt', v_row.created_at,
    'lastUsedAt', v_row.last_used_at, 'revokedAt', v_row.revoked_at
  );
end $$;
revoke execute on function public.api_key_revoke(uuid, uuid) from public, anon;
grant execute on function public.api_key_revoke(uuid, uuid) to authenticated;

-- The tables the public API reads for the workspace of a key.
drop policy if exists "leads_app_be_select" on public.leads;
create policy "leads_app_be_select" on public.leads for select to app_be using (workspace_id is not null);
grant select on table public.leads to app_be;

drop policy if exists "events_app_be_select" on public.events;
create policy "events_app_be_select" on public.events for select to app_be using (workspace_id is not null);
grant select on table public.events to app_be;

drop policy if exists "agent_conversations_app_be_select" on public.agent_conversations;
create policy "agent_conversations_app_be_select" on public.agent_conversations for select to app_be using (workspace_id is not null);
grant select on table public.agent_conversations to app_be;
