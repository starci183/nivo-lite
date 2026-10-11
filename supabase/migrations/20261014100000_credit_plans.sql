-- AI credits: one monthly allowance per plan, spent by the real token cost of every model call. Additive.
--   1 credit = 0.01 USD of sale price. A call spends cost_usd x 250 credits (x 100 credits per USD, x 2.5 so that the token cost is
--   at most 40% of what the credits sell for: a 60% gross margin on tokens; infrastructure is not counted).
--   Plans (VND per month, 26,000 VND per USD): Starter 299,000 = 1,150 credits; Pro 1,499,000 = 5,765; Max 4,999,000 = 19,227;
--   Enterprise is custom (sold by contract, never bought in the app): Max's allowance until ai_quota_overrides.credits_limit is set.
--   Growth is retired: its workspaces move to Pro. Credits are the one allowance: the message and token allowances are cleared.

alter table public.plans
  add column if not exists ai_credits_per_month bigint check (ai_credits_per_month is null or ai_credits_per_month >= 0),  -- null = unlimited
  add column if not exists is_custom boolean not null default false;                                                       -- contract plan, no self-serve checkout

insert into public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort, active, ai_credits_per_month, is_custom) values
  ('starter', 'Starter', 'Starter', 299000, 'month', 3,
    '{"vi": ["1.150 credit AI mỗi tháng", "Tối đa 3 thành viên", "Chatbot và AI bán hàng"], "en": ["1,150 AI credits a month", "Up to 3 members", "Chatbot and sales AI"]}', 1, true, 1150, false),
  ('pro', 'Pro', 'Pro', 1499000, 'month', 10,
    '{"vi": ["5.765 credit AI mỗi tháng", "Tối đa 10 thành viên", "Chatbot, AI bán hàng và AI kế toán"], "en": ["5,765 AI credits a month", "Up to 10 members", "Chatbot, sales AI and accounting AI"]}', 2, true, 5765, false),
  ('max', 'Max', 'Max', 4999000, 'month', 30,
    '{"vi": ["19.227 credit AI mỗi tháng", "Tối đa 30 thành viên", "Mọi module của NIVO"], "en": ["19,227 AI credits a month", "Up to 30 members", "Every NIVO module"]}', 3, true, 19227, false),
  ('enterprise', 'Enterprise', 'Enterprise', 0, 'month', 1000,
    '{"vi": ["Credit AI theo hợp đồng", "Số thành viên theo hợp đồng", "Hỗ trợ triển khai riêng"], "en": ["AI credits by contract", "Members by contract", "Dedicated onboarding"]}', 4, true, 19227, true)
on conflict (code) do update set
  name_vi = excluded.name_vi, name_en = excluded.name_en, price_vnd = excluded.price_vnd, period = excluded.period, seats = excluded.seats,
  features = excluded.features, sort = excluded.sort, active = excluded.active, ai_credits_per_month = excluded.ai_credits_per_month,
  is_custom = excluded.is_custom;

update public.plans set ai_messages_per_month = null, ai_tokens_per_month = null where code in ('starter', 'pro', 'max', 'enterprise');

-- Growth is retired; its workspaces (and any order still pending for it) move to Pro.
update public.workspaces set plan_code = 'pro' where plan_code = 'growth';
update public.payment_orders set plan_code = 'pro' where plan_code = 'growth' and status = 'pending';
update public.plans set active = false where code = 'growth';

alter table public.ai_quota_overrides
  add column if not exists credits_limit bigint check (credits_limit is null or credits_limit >= 0);   -- null = the plan's allowance

-- ---------------------------------------------------------------- this month vs allowance, now with credits
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
      coalesce(sum(e.prompt_tokens + e.completion_tokens), 0) as tokens,
      coalesce(sum(e.cost_usd), 0) as cost
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
