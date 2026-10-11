-- Credit bonus and rollover for upsell. Additive; builds on 20261015100000_guide_usage.sql (guide rows stay out of the sums).
--   Starter is sold at par (1,150 credits = 299,000 VND). Pro gets +20% (6,918 credits, about 217 VND a credit, 52% token
--   margin when fully used); Max +25% (24,034 credits, about 208 VND a credit, 50%). Enterprise is by contract with a 50% floor.
--   Rollover (Pro, Max): the credits left from the previous month carry into this one, at most one month's allowance and only
--   from the month just before (no chains). A workspace that existed for part of last month carries only that share, so a
--   new sign-up never starts with a double allowance. A workspace with its own contract allowance (ai_quota_overrides) does
--   not roll over. The carry uses the current plan's allowance for last month too.

alter table public.plans
  add column if not exists credits_rollover boolean not null default false;

update public.plans set ai_credits_per_month = 6918, credits_rollover = true,
  features = '{"vi": ["6.918 credit AI mỗi tháng (tặng thêm 20%)", "Credit chưa dùng được cộng sang tháng sau", "Tối đa 10 thành viên", "Chatbot, AI bán hàng và AI kế toán"], "en": ["6,918 AI credits a month (20% bonus)", "Unused credits roll over to next month", "Up to 10 members", "Chatbot, sales AI and accounting AI"]}'
  where code = 'pro';
update public.plans set ai_credits_per_month = 24034, credits_rollover = true,
  features = '{"vi": ["24.034 credit AI mỗi tháng (tặng thêm 25%)", "Credit chưa dùng được cộng sang tháng sau", "Mọi module của NIVO"], "en": ["24,034 AI credits a month (25% bonus)", "Unused credits roll over to next month", "Every NIVO module"]}'
  where code = 'max';
update public.plans set ai_credits_per_month = 24034 where code = 'enterprise';

drop function if exists public.ai_quota_status(uuid);
create function public.ai_quota_status(p_workspace uuid)
returns table (
  period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric,
  messages_limit int, tokens_limit bigint, fallback_reply text,
  credits_used numeric, credits_limit bigint, credits_carried numeric
) language sql stable security definer set search_path = public as $$
  with p as (
    select date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date as d,
           (date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh') - interval '1 month')::date as pd
  ), u as (
    select
      count(*) filter (where e.kind = 'chat_reply' and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d) as messages,
      coalesce(sum(e.prompt_tokens + e.completion_tokens) filter (where e.kind <> 'guide' and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as tokens,
      coalesce(sum(e.cost_usd) filter (where e.kind <> 'guide' and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as cost,
      coalesce(sum(e.cost_usd) filter (where e.kind <> 'guide' and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.d), 0) as prev_cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.pd
  ), b as (
    select
      p.d, p.pd, w.created_at, o.credits_limit as own_limit, pl.credits_rollover,
      coalesce(o.credits_limit, pl.ai_credits_per_month) as base,
      o.messages_limit, o.tokens_limit, o.fallback_reply, pl.ai_messages_per_month, pl.ai_tokens_per_month
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
            - (select u.prev_cost from u) * 250))
        else 0
      end as carry
    from b
  )
  select
    c.d,
    u.messages,
    u.tokens::bigint,
    u.cost,
    coalesce(c.messages_limit, c.ai_messages_per_month),
    coalesce(c.tokens_limit, c.ai_tokens_per_month),
    c.fallback_reply,
    round(u.cost * 250, 2),
    case when c.base is null then null else floor(c.base + c.carry)::bigint end,
    round(c.carry, 2)
  from c cross join u;
$$;
revoke all on function public.ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid) to service_role;
