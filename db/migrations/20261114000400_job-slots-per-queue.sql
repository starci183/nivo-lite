-- job-slots-per-queue: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- R25 (coordinator, the owner's "max parallel 100"): a self-hosted install has ONE workspace and must reach N agent runs at once.
-- Until now `public.job_start` counted a workspace's slots over EVERY queue against the app's workspace limit
-- (`QUEUE_WORKSPACE_CONCURRENCY`, dev 6) plus the starting job's headroom: the agent-turn drains, whose headroom is the runs one
-- workspace may hold (`AGENT_RUNS_WORKSPACE_CONCURRENCY`, default N), could reach N, but while six or more of them ran every OTHER job of
-- the workspace (a customer send, an index, a sync: headroom 0) found the workspace busy and waited, so N runs starved the rest.
-- From this migration a job is counted against the slots of ITS OWN queue only: each queue of a workspace has its own budget (the app's
-- workspace limit plus the job's headroom), so the drains of one workspace reach N without taking the slots of its other work. The
-- fair-group rule (one slot beyond the limit for a group with nothing running) is unchanged, counted inside the queue as well.

CREATE INDEX IF NOT EXISTS job_slots_ws_queue ON public.job_slots USING btree (workspace_id, queue);

CREATE OR REPLACE FUNCTION public.job_start(p_queue text, p_id uuid, p_ws_limit integer, p_lease_s integer)
    RETURNS TABLE(outcome text, attempt integer, state text, run_token uuid)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o public.job_outbox; v_ws uuid; v_busy int; v_attempt int; v_until timestamptz; v_token uuid;
begin
  select * into o from public.job_outbox r where r.id = p_id and r.queue = p_queue for update;
  if o.id is null then return query select 'missing'::text, 0, 'missing'::text, null::uuid; return; end if;
  if o.state in ('done', 'failed') then return query select 'terminal'::text, o.attempts, o.state, o.run_token; return; end if;
  if o.state = 'running' and o.run_lease_until > now() then
    return query select 'busy'::text, o.attempts, o.state, o.run_token; return;
  end if;
  v_ws := o.workspace_id;
  v_until := now() + make_interval(secs => greatest(5, p_lease_s));
  if v_ws is not null then
    perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
    delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
    select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and s.queue = o.queue and s.job_id <> o.id;
    if v_busy >= greatest(1, p_ws_limit) then return query select 'busy'::text, o.attempts, o.state, o.run_token; return; end if;
    insert into public.job_slots as s (queue, job_id, workspace_id, lease_until)
    values (o.queue, o.id, v_ws, v_until)
    on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until;
  end if;
  update public.job_outbox r set attempts = r.attempts + 1, state = 'running', started_at = now(), run_lease_until = v_until, run_token = gen_random_uuid()
  where r.id = o.id returning r.attempts, r.run_token into v_attempt, v_token;
  return query select 'started'::text, v_attempt, 'running'::text, v_token;
end $$;

CREATE OR REPLACE FUNCTION public.job_start(p_queue text, p_id uuid, p_ws_limit integer, p_lease_s integer, p_group text)
    RETURNS TABLE(outcome text, attempt integer, state text, run_token uuid)
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare o public.job_outbox; v_ws uuid; v_busy int; v_mine int; v_limit int; v_attempt int; v_until timestamptz; v_token uuid;
begin
  select * into o from public.job_outbox r where r.id = p_id and r.queue = p_queue for update;
  if o.id is null then return query select 'missing'::text, 0, 'missing'::text, null::uuid; return; end if;
  if o.state in ('done', 'failed') then return query select 'terminal'::text, o.attempts, o.state, o.run_token; return; end if;
  if o.state = 'running' and o.run_lease_until > now() then
    return query select 'busy'::text, o.attempts, o.state, o.run_token; return;
  end if;
  v_ws := o.workspace_id;
  v_until := now() + make_interval(secs => greatest(5, p_lease_s));
  if v_ws is not null then
    perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
    delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
    select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and s.queue = o.queue and s.job_id <> o.id;
    v_limit := greatest(1, p_ws_limit);
    if p_group is not null then
      select count(*) into v_mine from public.job_slots s
        where s.workspace_id = v_ws and s.queue = o.queue and s.group_key = p_group and s.job_id <> o.id;
      -- A group with nothing running may take one slot beyond the limit: it never waits behind another group's chain of jobs.
      if v_mine = 0 then v_limit := v_limit + 1; end if;
    end if;
    if v_busy >= v_limit then return query select 'busy'::text, o.attempts, o.state, o.run_token; return; end if;
    insert into public.job_slots as s (queue, job_id, workspace_id, lease_until, group_key)
    values (o.queue, o.id, v_ws, v_until, p_group)
    on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until, group_key = excluded.group_key;
  end if;
  update public.job_outbox r set attempts = r.attempts + 1, state = 'running', started_at = now(), run_lease_until = v_until, run_token = gen_random_uuid()
  where r.id = o.id returning r.attempts, r.run_token into v_attempt, v_token;
  return query select 'started'::text, v_attempt, 'running'::text, v_token;
end $$;
