-- Operator reads and the bulk retry of the job outbox for the be CLI (`cli jobs failed|open|retry-failed`), as definer functions: the
-- least-privilege role app_be has no table grant on job_outbox, so the be asks these functions, like job_stats() and job_requeue().

CREATE OR REPLACE FUNCTION public.job_failed(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, name text, attempts integer, finished_at timestamp with time zone, last_error text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select o.id, o.name, o.attempts, o.finished_at, o.last_error
  from public.job_outbox o
  where o.state = 'failed'
  order by o.finished_at desc nulls last
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

CREATE OR REPLACE FUNCTION public.job_open(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, name text, state text, attempts integer, created_at timestamp with time zone, last_error text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select o.id, o.name, o.state, o.attempts, o.created_at, o.last_error
  from public.job_outbox o
  where o.state in ('queued', 'running')
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

CREATE OR REPLACE FUNCTION public.job_requeue_failed(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r record;
  v_failed integer := 0;
  v_requeued integer := 0;
begin
  for r in
    select o.id from public.job_outbox o
    where o.state = 'failed' and o.finished_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720))
    order by o.finished_at
  loop
    v_failed := v_failed + 1;
    if public.job_requeue(r.id) is not null then v_requeued := v_requeued + 1; end if;
  end loop;
  return jsonb_build_object('requeued', v_requeued, 'failed', v_failed);
end $$;

REVOKE EXECUTE ON FUNCTION public.job_failed(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_open(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_requeue_failed(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_failed(integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_open(integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_requeue_failed(integer) TO app_be;
