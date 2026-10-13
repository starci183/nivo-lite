-- What the platform-admin console of the back end (be/) needs beyond the app_be grants of 20261012130100.
-- The emails of OTHER Auth users are read through one security definer function in a schema the data API does not expose,
-- so app_be never touches auth.* directly and the console lists a thousand owners in one query instead of one Auth call each.

create schema if not exists be_access;
revoke all on schema be_access from public;
grant usage on schema be_access to app_be;

-- The emails and last sign-ins of the given Auth users.
create or replace function be_access.user_emails(p_ids uuid[])
returns table (id uuid, email text, last_sign_in_at timestamptz)
language sql stable security definer set search_path = ''
as $$
    select u.id, u.email::text, u.last_sign_in_at from auth.users u where u.id = any (p_ids);
$$;

revoke all on function be_access.user_emails(uuid[]) from public, anon, authenticated;
grant execute on function be_access.user_emails(uuid[]) to app_be;

-- The existing console functions, now also callable by the API role.
grant execute on function public.admin_workspace_stats() to app_be;
grant execute on function public.admin_signups_per_day(int) to app_be;
grant execute on function public.ai_quota_status(uuid) to app_be;
