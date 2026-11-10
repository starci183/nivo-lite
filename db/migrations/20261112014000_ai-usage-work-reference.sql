-- ai-usage-work-reference: forward-only; immutable once on origin/main.
-- Owner, 2026-11-11 ("làm gì ghi rõ model, số credits trên từng node"): every model or embedding call is booked with the work it was
-- made for, so the run page, the graph, Second Brain and the learning card can show its model and credits.
--   work_kind           what kind of work the call served: node, engine_core, document_read, document_reread, document_critique,
--                       learning, chat_turn (null: a fixed task of the app, or a row booked before this migration).
--   work_ref            the record it served, `<what>:<id>`: source:<knowledge source id>, lesson:<lesson candidate id>,
--                       message:<room id>/<message id>; null for engine work (run_id + step_key say it).
--   step_key            the step of the agent run a graph node's call was made in (the graph node's key).
--   agent_id            the agent whose work it was (graph read: the calls of one agent's graph).
--   cache_write_tokens  prompt tokens WRITTEN to the provider's prompt cache (Anthropic bills them above the input price); 0 when not told.
--   failure             null for an answered call; for a FAILED TRY (timeout, provider, length, empty, not_json) the failure code: such a
--                       row is `estimated` (prompt tokens counted by the app, 0 output) and priced, but it is NOT billed: the billing
--                       functions below are re-created with `failure IS NULL`, so what a shop is billed is exactly what it was before
--                       (billing failed tries is a decision for the owner).
-- Expand only. Apply BEFORE the dist that carries U1: TypeORM inserts every entity column, and the knowledge meter calls the new
-- function `record_ai_usage_work`; on an unmigrated database every usage row would be lost (the writers never throw; they log).

ALTER TABLE public.ai_usage_events ADD COLUMN work_kind text;
ALTER TABLE public.ai_usage_events ADD COLUMN work_ref text;
ALTER TABLE public.ai_usage_events ADD COLUMN step_key text;
ALTER TABLE public.ai_usage_events ADD COLUMN agent_id uuid;
ALTER TABLE public.ai_usage_events ADD COLUMN cache_write_tokens integer DEFAULT 0 NOT NULL;
ALTER TABLE public.ai_usage_events ADD COLUMN failure text;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_work_kind_check CHECK (work_kind IS NULL OR char_length(work_kind) <= 40);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_work_ref_check CHECK (work_ref IS NULL OR char_length(work_ref) <= 200);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_step_key_check CHECK (step_key IS NULL OR char_length(step_key) <= 120);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_cache_write_tokens_check CHECK (cache_write_tokens >= 0);
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_failure_check CHECK (failure IS NULL OR char_length(failure) <= 40);

-- The graph read: the calls of one agent in the last days, grouped by step.
CREATE INDEX ai_usage_events_agent_time ON public.ai_usage_events USING btree (workspace_id, agent_id, created_at DESC) WHERE agent_id IS NOT NULL;
-- The document and learning reads: the calls made for given records.
CREATE INDEX ai_usage_events_work_ref ON public.ai_usage_events USING btree (workspace_id, work_ref) WHERE work_ref IS NOT NULL;

-- The knowledge meter's writer, with the run, the work and the call facts (the old `record_ai_usage` stays for an old dist).
CREATE FUNCTION public.record_ai_usage_work(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean, p_facts jsonb) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.ai_usage_events (
    workspace_id, kind, module, model, prompt_tokens, completion_tokens, cost_usd, estimated,
    run_id, work_kind, work_ref, step_key, agent_id, failure, try_number, duration_ms, purpose
  )
  values (
    p_workspace, p_kind, p_module, p_model, greatest(p_prompt, 0), greatest(p_completion, 0), greatest(p_cost, 0), p_estimated,
    nullif(p_facts->>'run_id', '')::uuid,
    left(nullif(p_facts->>'work_kind', ''), 40),
    left(nullif(p_facts->>'work_ref', ''), 200),
    left(nullif(p_facts->>'step_key', ''), 120),
    nullif(p_facts->>'agent_id', '')::uuid,
    left(nullif(p_facts->>'failure', ''), 40),
    case when (p_facts->>'try_number') ~ '^[0-9]{1,2}$' and (p_facts->>'try_number')::int between 1 and 10
         then (p_facts->>'try_number')::smallint end,
    case when (p_facts->>'duration_ms') ~ '^[0-9]{1,9}$' then (p_facts->>'duration_ms')::int end,
    left(nullif(p_facts->>'purpose', ''), 200)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.record_ai_usage_work(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean, p_facts jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage_work(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean, p_facts jsonb) TO app_be;

-- Billing stays exactly as before: a failed try is never billed (the three functions are the baseline's, plus `failure IS NULL`).
CREATE OR REPLACE FUNCTION public.ai_credit_period(p_workspace uuid, p_period date) RETURNS TABLE(used numeric, base bigint, carry numeric, credits_limit bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with p as (
    select p_period as d,
           (p_period - interval '1 month')::date as pd,
           (p_period + interval '1 month')::date as nd
  ), u as (
    select
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as cost,
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.d), 0) as prev_cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace and e.kind <> 'guide' and e.failure is null
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.pd
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.nd
  ), k as (
    select coalesce(sum(x.credits), 0) as credits
    from public.credit_pack_purchases x, p
    where x.workspace_id = p_workspace and x.period = p.d
  ), b as (
    select
      p.d, p.pd, w.created_at, o.credits_limit as own_limit, pl.credits_rollover,
      coalesce(
        o.credits_limit,
        case when pl.per_seat
             then coalesce(w.tier_credits, pl.ai_credits_per_month) * greatest(coalesce(w.seat_count, 1), 1)
             else pl.ai_credits_per_month end
      ) as base
    from p
    left join public.workspaces w on w.id = p_workspace
    left join public.plans pl on pl.code = w.plan_code
    left join public.ai_quota_overrides o on o.workspace_id = p_workspace
  ), c as (
    select b.*,
      case
        when b.own_limit is null and coalesce(b.credits_rollover, false) and b.base is not null
             and (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date < b.d
        then greatest(0, least(
          b.base::numeric,
          b.base::numeric * least(1, (b.d - greatest(b.pd, (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date))::numeric / (b.d - b.pd))
            - (select u.prev_cost from u)))
        else 0
      end as carry
    from b
  )
  select u.cost, c.base, c.carry,
         case when c.base is null then null else floor(c.base + c.carry + (select k.credits from k))::bigint end
  from c cross join u;
$$;

CREATE OR REPLACE FUNCTION public.ai_quota_status(p_workspace uuid) RETURNS TABLE(period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric, messages_limit integer, tokens_limit bigint, fallback_reply text, credits_used numeric, credits_limit bigint, credits_carried numeric, topup_balance bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with p as (
    select date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date as d
  ), u as (
    select
      count(*) filter (where e.kind = 'chat_reply') as messages,
      coalesce(sum(e.prompt_tokens + e.completion_tokens) filter (where e.kind <> 'guide'), 0) as tokens,
      coalesce(sum(e.cost_usd) filter (where e.kind <> 'guide'), 0) as cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace and e.failure is null
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d
  ), cr as (
    select * from public.ai_credit_period(p_workspace, (select d from p))
  ), t as (
    select
      coalesce((select sum(k.credits_remaining) from public.credit_topups k
                where k.workspace_id = p_workspace and k.credits_remaining > 0 and k.expires_at > now()), 0) as lots,
      coalesce((select dr.drawn from public.credit_topup_draws dr
                where dr.workspace_id = p_workspace and dr.period = (select d from p)), 0) as drawn
  )
  select
    p.d,
    u.messages,
    u.tokens::bigint,
    u.cost,
    coalesce(o.messages_limit, pl.ai_messages_per_month),
    coalesce(o.tokens_limit, pl.ai_tokens_per_month),
    o.fallback_reply,
    cr.used,
    cr.credits_limit,
    round(cr.carry, 2),
    case when cr.credits_limit is null then 0
         else greatest(0, t.lots - greatest(0, ceil(greatest(0, cr.used - cr.credits_limit)) - t.drawn))::bigint
    end
  from p
  cross join u
  cross join cr
  cross join t
  left join public.workspaces w on w.id = p_workspace
  left join public.plans pl on pl.code = w.plan_code
  left join public.ai_quota_overrides o on o.workspace_id = p_workspace;
$$;

CREATE OR REPLACE FUNCTION public.ai_usage_events_settle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.kind = 'guide' or new.cost_usd <= 0 or new.failure is not null then return null; end if;
  if not exists (
    select 1 from public.credit_topups where workspace_id = new.workspace_id and credits_remaining > 0 and expires_at > now()
  ) then
    return null;
  end if;
  begin
    perform public.settle_credit_topups(new.workspace_id);
  exception when others then
    raise warning 'settle_credit_topups failed for %: %', new.workspace_id, sqlerrm;
  end;
  return null;
end;
$$;
