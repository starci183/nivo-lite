-- NIVO guide (the in-app navigation assistant): NIVO pays for its tokens, so they are metered under their own kind
-- 'guide' and never count toward a workspace's monthly allowance (tokens, cost or credits). Additive; builds on
-- 20261014100000_credit_plans.sql (same ai_quota_status shape, guide rows left out of the sums).

alter table public.ai_usage_events drop constraint if exists ai_usage_events_kind_check;
alter table public.ai_usage_events
  add constraint ai_usage_events_kind_check
  check (kind in ('chat_reply', 'setup', 'owner_chat', 'relay', 'embedding', 'engine', 'guide'));

drop function if exists public.ai_quota_status(uuid);
create function public.ai_quota_status(p_workspace uuid)
returns table (
  period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric,
  messages_limit int, tokens_limit bigint, fallback_reply text,
  credits_used numeric, credits_limit bigint
) language sql stable security definer set search_path = public as $$
  with p as (
    select date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date as d
  ), u as (
    select
      count(*) filter (where e.kind = 'chat_reply') as messages,
      coalesce(sum(e.prompt_tokens + e.completion_tokens) filter (where e.kind <> 'guide'), 0) as tokens,
      coalesce(sum(e.cost_usd) filter (where e.kind <> 'guide'), 0) as cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d
  )
  select
    p.d,
    u.messages,
    u.tokens::bigint,
    u.cost,
    coalesce(o.messages_limit, pl.ai_messages_per_month),
    coalesce(o.tokens_limit, pl.ai_tokens_per_month),
    o.fallback_reply,
    round(u.cost * 250, 2),
    coalesce(o.credits_limit, pl.ai_credits_per_month)
  from p
  cross join u
  left join public.workspaces w on w.id = p_workspace
  left join public.plans pl on pl.code = w.plan_code
  left join public.ai_quota_overrides o on o.workspace_id = p_workspace;
$$;
revoke all on function public.ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid) to service_role;
