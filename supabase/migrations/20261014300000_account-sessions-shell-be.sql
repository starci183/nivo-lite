-- The account and shell doors of the lite back end (be/): app_be has no auth.uid(), so the device list, the linked sign-in
-- methods and the revocation of a device take the user as an argument and run as definer; shell_data is callable by app_be.

create or replace function public.be_account_sessions(p_user uuid)
returns table (id uuid, created_at timestamptz, last_active_at timestamptz, user_agent text, ip text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active_at,
         s.user_agent,
         host(s.ip) as ip
    from auth.sessions s
   where s.user_id = p_user
     and (s.not_after is null or s.not_after > now())
   order by 3 desc nulls last
   limit 100;
$$;

create or replace function public.be_account_providers(p_user uuid)
returns table (provider text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct i.provider from auth.identities i where i.user_id = p_user order by 1;
$$;

-- Deleting the session row cascades to its refresh tokens (FK on delete cascade).
create or replace function public.be_revoke_session(p_user uuid, p_session uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare removed int;
begin
  delete from auth.sessions s where s.id = p_session and s.user_id = p_user;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.be_account_sessions(uuid), public.be_account_providers(uuid),
  public.be_revoke_session(uuid, uuid) from public, anon, authenticated;
grant execute on function public.be_account_sessions(uuid), public.be_account_providers(uuid),
  public.be_revoke_session(uuid, uuid) to app_be;
grant execute on function public.shell_data(uuid, timestamptz, timestamptz) to app_be;
