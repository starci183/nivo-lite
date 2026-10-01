-- Account area: a signed-in user lists and revokes their OWN auth sessions.
-- security definer reads auth.sessions (not exposed to the API); every function is scoped to auth.uid().

create or replace function public.my_sessions()
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
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by 3 desc nulls last;
$$;

-- Deleting the session row cascades to its refresh tokens (FK on delete cascade).
create or replace function public.revoke_my_session(session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare removed int;
begin
  if auth.uid() is null then
    return false;
  end if;
  delete from auth.sessions s where s.id = session_id and s.user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

revoke all on function public.my_sessions() from public, anon;
revoke all on function public.revoke_my_session(uuid) from public, anon;
grant execute on function public.my_sessions() to authenticated;
grant execute on function public.revoke_my_session(uuid) to authenticated;
