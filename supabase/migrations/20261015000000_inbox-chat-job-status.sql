-- Browser polling reaches the queue through GraphQL and the verified backend principal.
-- Keep job_outbox private; expose only state and identity for these workspace jobs to app_be.
create or replace function public.job_status(p_workspace uuid, p_queue text, p_dedupe text)
returns table (id uuid, state text, attempts integer)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.state, o.attempts
  from public.job_outbox o
  where o.workspace_id = p_workspace
    and o.queue = p_queue
    and o.dedupe_key = p_dedupe
    and p_queue in ('chat_turn', 'decisions')
  limit 1
$$;

revoke all on function public.job_status(uuid, text, text) from public, anon, authenticated;
grant execute on function public.job_status(uuid, text, text) to app_be;
