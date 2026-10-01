-- Zalo Official Account: real send and receive.
--   connection_secrets.token_expires_at   when the OA access token (1 hour) stops working; the refresh job and lazy refresh read it.
--   connection_secrets.refresh_lock_until a short lease: Zalo refresh tokens are single use, so only ONE caller may refresh at a time.
--   agent_messages.delivery_error         why a push to the customer's channel failed (a stable code the workbench translates).
--   cron_targets / zalo_refresh_tick()    pg_cron calls a protected app route every 6 hours (engine independent) so tokens never lapse.
alter table public.connection_secrets add column if not exists token_expires_at timestamptz;
alter table public.connection_secrets add column if not exists refresh_lock_until timestamptz;
create index if not exists connection_secrets_token_expiry on public.connection_secrets (token_expires_at) where token_expires_at is not null;

alter table public.agent_messages add column if not exists delivery_error text;

-- Where a scheduled job must call (url + the bearer secret). Service role only; the app registers its own row when a Zalo OA is connected.
create table if not exists public.cron_targets (
  name text primary key,
  url text not null,
  secret text not null,
  updated_at timestamptz not null default now()
);
alter table public.cron_targets enable row level security;
revoke all on public.cron_targets from anon, authenticated;

create or replace function public.zalo_refresh_tick() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  t public.cron_targets%rowtype;
  v bigint := 0;
begin
  select * into t from public.cron_targets where name = 'zalo-refresh';
  if not found then return 0; end if;
  if not exists (select 1 from public.connections where provider = 'zalo_oa' and status <> 'disconnected') then return 0; end if;
  begin
    execute 'select net.http_post(url := $1, headers := jsonb_build_object(''Authorization'', ''Bearer '' || $2, ''Content-Type'', ''application/json''), body := ''{}''::jsonb)'
      into v using t.url, t.secret;
  exception when others then
    raise warning 'zalo_refresh_tick failed: %', sqlerrm;
  end;
  return coalesce(v, 0);
end $$;
revoke all on function public.zalo_refresh_tick() from public, anon, authenticated;
grant execute on function public.zalo_refresh_tick() to service_role;

-- pg_cron and pg_net are optional extensions: where one is missing the migration still applies (call the route from any other scheduler).
do $$
begin
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net is not available here (%); zalo_refresh_tick() cannot call the app', sqlerrm;
  end;
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron is not available here (%); zalo-refresh is not scheduled', sqlerrm;
  end;
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.schedule('zalo-refresh', '0 */6 * * *', 'select public.zalo_refresh_tick()');
    exception when others then
      raise notice 'could not schedule zalo-refresh (%)', sqlerrm;
    end;
  end if;
end $$;
