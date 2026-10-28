-- The be records every unexpected failure in app_errors (the team console, /admin/health). A failure that belongs to no workspace
-- (a malformed webhook, a platform job) must be stored too, so the app_be insert policy no longer requires a workspace. Reads stay
-- scoped: app_be still selects only workspace rows, and the platform admins read everything through their own policy.
drop policy if exists "app_errors_app_be_insert" on public.app_errors;
create policy "app_errors_app_be_insert" on public.app_errors for insert to app_be with check (true);

-- The one write of the be's error reporter: the workspace is the given one, else the workspace of the given connection.
create or replace function public.app_errors_record(p_scope text, p_message text, p_stack text, p_ws uuid, p_connection uuid, p_ctx jsonb)
returns void language plpgsql set search_path = public as $fn$
declare
  v_ws uuid := p_ws;
begin
  if v_ws is null and p_connection is not null then
    select c.workspace_id into v_ws from public.connections c where c.id = p_connection;
  end if;
  insert into public.app_errors (scope, message, stack, workspace_id, ctx)
  values (left(coalesce(p_scope, ''), 200), left(coalesce(p_message, ''), 4000), left(p_stack, 8000), v_ws, coalesce(p_ctx, '{}'::jsonb));
end
$fn$;
revoke all on function public.app_errors_record(text, text, text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.app_errors_record(text, text, text, uuid, uuid, jsonb) to app_be;
