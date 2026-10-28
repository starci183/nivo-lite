-- Lane "api": the outgoing webhook and Google providers, workspace API keys and the per-key rate limit.
--   connections.provider gains 'webhook' (n8n / Make / Zapier / any HTTP receiver) and 'google' (Google Sheets through OAuth).
--   workspace_api_keys  one row per key: only the SHA-256 of the key is stored (the key is shown once), plus a prefix to recognise it.
--   api_rate_limits     one counter per key per minute; api_rate_hit() increments and returns the count in ONE statement.
-- Tables have no client policy: the app reads and writes them with the service role after checking owner|manager.

alter table public.connections drop constraint if exists connections_provider_check;
alter table public.connections add constraint connections_provider_check
  check (provider in ('telegram', 'sepay', 'zalo_oa', 'payos', 'casso', 'webhook', 'google'));

create table public.workspace_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{leads:read,leads:write,messages:write,knowledge:write,events:read}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index workspace_api_keys_workspace on public.workspace_api_keys (workspace_id, created_at desc);
alter table public.workspace_api_keys enable row level security;
revoke all on public.workspace_api_keys from anon, authenticated;

create table public.api_rate_limits (
  key_id uuid not null references public.workspace_api_keys (id) on delete cascade,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key_id, window_start)
);
alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.api_rate_hit(p_key uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_window timestamptz := date_trunc('minute', now()); v_hits int;
begin
  insert into public.api_rate_limits as r (key_id, window_start, hits) values (p_key, v_window, 1)
  on conflict (key_id, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if random() < 0.02 then delete from public.api_rate_limits where window_start < now() - interval '1 hour'; end if;
  return v_hits;
end $$;
revoke all on function public.api_rate_hit(uuid) from public, anon, authenticated;
grant execute on function public.api_rate_hit(uuid) to service_role;
