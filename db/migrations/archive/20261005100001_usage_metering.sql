-- AI usage metering and plan quotas. Additive.
--   ai_usage_events     one row per model call (chat, setup, owner chat, relay, embedding, engine): tokens and cost
--   ai_usage_daily      per-day rollup view (security_invoker: RLS of the events table applies)
--   plans.ai_*          monthly allowance per plan (TO_CONFIRM placeholders; null = unlimited)
--   ai_quota_overrides  per-workspace allowance and fallback reply (service role writes; managers read)
--   ai_usage_notices    "80% used" / "limit reached" notices, one per workspace, month and level
--   ai_quota_status     this month's use against the allowance (service role only: the app reads it before every model call)
-- Members read their workspace's events; every write goes through the service role (the shared model layer).

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  kind text not null check (kind in ('chat_reply', 'setup', 'owner_chat', 'relay', 'embedding', 'engine')),
  module text not null default 'other',            -- chatbot | sales | accounting | setup | office | knowledge | other
  model text not null default '',
  prompt_tokens int not null default 0 check (prompt_tokens >= 0),
  completion_tokens int not null default 0 check (completion_tokens >= 0),
  cost_usd numeric(14, 8) not null default 0 check (cost_usd >= 0),
  estimated boolean not null default false,        -- true when the provider sent no usage and the tokens were estimated
  created_at timestamptz not null default now()
);
create index ai_usage_events_ws_time on public.ai_usage_events (workspace_id, created_at desc);

alter table public.ai_usage_events enable row level security;
create policy ai_usage_events_read on public.ai_usage_events for select using (public.is_member(workspace_id));

-- Day boundaries follow Vietnam time (the product's time zone).
create view public.ai_usage_daily with (security_invoker = true) as
select
  workspace_id,
  (created_at at time zone 'Asia/Ho_Chi_Minh')::date as day,
  kind,
  module,
  count(*)::int as calls,
  sum(prompt_tokens)::bigint as prompt_tokens,
  sum(completion_tokens)::bigint as completion_tokens,
  sum(cost_usd)::numeric(16, 8) as cost_usd
from public.ai_usage_events
group by workspace_id, (created_at at time zone 'Asia/Ho_Chi_Minh')::date, kind, module;
revoke all on public.ai_usage_daily from anon;
grant select on public.ai_usage_daily to authenticated, service_role;

-- ---------------------------------------------------------------- allowances
-- TO_CONFIRM: every number below is a PLACEHOLDER. The owner sets the real ones
-- (update public.plans set ai_messages_per_month = ..., ai_tokens_per_month = ... where code = ...). null = unlimited.
alter table public.plans
  add column ai_messages_per_month int check (ai_messages_per_month is null or ai_messages_per_month >= 0),   -- customer replies per month
  add column ai_tokens_per_month bigint check (ai_tokens_per_month is null or ai_tokens_per_month >= 0);      -- all model tokens per month
update public.plans set ai_messages_per_month = 1500, ai_tokens_per_month = 3000000 where code = 'starter';   -- TO_CONFIRM
update public.plans set ai_messages_per_month = 6000, ai_tokens_per_month = 12000000 where code = 'growth';  -- TO_CONFIRM

create table public.ai_quota_overrides (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  messages_limit int check (messages_limit is null or messages_limit >= 0),   -- null = the plan's allowance
  tokens_limit bigint check (tokens_limit is null or tokens_limit >= 0),
  fallback_reply text,                                                          -- null = the default polite reply in code
  note text,
  updated_at timestamptz not null default now()
);
alter table public.ai_quota_overrides enable row level security;
create policy ai_quota_overrides_read on public.ai_quota_overrides for select using (public.is_manager(workspace_id));

create table public.ai_usage_notices (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period date not null,                            -- first day of the month (Vietnam time)
  level text not null check (level in ('warn', 'exceeded')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, period, level)
);
alter table public.ai_usage_notices enable row level security;   -- service role only: no policy

-- ---------------------------------------------------------------- this month vs allowance
create or replace function public.ai_quota_status(p_workspace uuid)
returns table (
  period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric,
  messages_limit int, tokens_limit bigint, fallback_reply text
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
    o.fallback_reply
  from p
  cross join u
  left join public.workspaces w on w.id = p_workspace
  left join public.plans pl on pl.code = w.plan_code
  left join public.ai_quota_overrides o on o.workspace_id = p_workspace;
$$;
revoke all on function public.ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid) to service_role;
