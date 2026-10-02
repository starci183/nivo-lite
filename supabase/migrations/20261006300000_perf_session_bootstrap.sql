-- Perf: one round trip for "who am I here". The app runs far from the database (about 220 ms per request), so the
-- session bootstrap used to cost 4 sequential requests (members, workspace, authority flag, switcher list).
-- SECURITY INVOKER: every table below is read under the caller's RLS, so a person only ever gets their own memberships.
create or replace function public.session_bootstrap()
returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'member', to_jsonb(m),
           'workspace', to_jsonb(w),
           'demo_seeded', (a.demo_seeded_at is not null)
         ) order by m.created_at), '[]'::jsonb)
  from public.workspace_members m
  left join public.workspaces w on w.id = m.workspace_id
  left join public.authority a on a.workspace_id = m.workspace_id
  where m.user_id = auth.uid();
$$;

revoke all on function public.session_bootstrap() from public, anon;
grant execute on function public.session_bootstrap() to authenticated;
