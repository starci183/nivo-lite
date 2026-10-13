-- Workspace-scoped progress for backend GraphQL status queries. The outbox itself remains private.
-- Backend handlers prove membership before calling this function; browser roles cannot execute it.
create or replace function public.job_status(
    p_workspace_id uuid,
    p_queue text,
    p_name text,
    p_dedupe_key text
)
returns table (id uuid, state text)
language sql
stable
security definer
set search_path = ''
as $$
    select o.id, o.state
    from public.job_outbox o
    where o.workspace_id = p_workspace_id
        and o.queue = p_queue
        and o.name = p_name
        and o.dedupe_key = p_dedupe_key
    limit 1;
$$;

revoke all on function public.job_status(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.job_status(uuid, text, text, text) to app_be, service_role;
