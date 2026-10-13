-- Add-on credit packs (owner 2026-10-13): every plan has a FIXED monthly allowance (Start 10,000 / Pro 20,000 / Max 100,000 / Team a level per seat).
-- The usage rows of the offer (plan_usage_tiers with per_seat = false) are OPTIONAL packs bought on top of the plan: a pack adds its
-- credits to the current month's allowance, the plan price never changes with packs, and a pack can be bought again.
-- Only Team keeps a per-seat level as its plan choice (plan_usage_tiers with per_seat = true).
-- A credit is never converted to money: a pack has its own price, nothing divides it by its credits.
--
-- SPEND CALIBRATION (owner 2026-10-13): a credit is defined in DOLLARS OF TOKEN USAGE. billing_config.credit_usd_value = 0.00113 USD of model
-- token cost per credit (= 1/885); a call spends ceil(cost_usd / credit_usd_value) credits, cost_usd being the tokens x the model's USD price
-- per token. It was cost_usd x 250 (0.004 USD per credit). Derivation, kept as documented inputs in the same table:
--     credit_usd_value = min revenue per included credit (VND) x (1 - target_margin) / exchange rate (VND per USD)
--                      = 49 (Start 490,000 / 10,000) x (1 - 0.40) / 26,000 = 0.001131 -> 0.00113
-- so every plan keeps at least 40% gross margin on token cost (Start 40.0%, Pro 40.6%, Max and Team about 41%; packs about 70%).
-- Every spend path (chat, agents, video, deep research, ...) writes ai_usage_events.cost_usd and is converted by ai_credit_period only.
--
--   credit_pack_purchases  one row per paid pack order: credits, price, and the month (Vietnam time) it counts for
--   payment_orders / payment_order_requests  + kind 'credit_pack' (target = the pack's credits)
--   billing_config         the calibration inputs and credit_usd_value (retune here, nowhere else)
--   ai_credit_period       spend = sum(ceil(cost_usd / credit_usd_value)) per call; allowance = plan allowance x seats (Team: level x seats) + the packs bought this month
--   settle_payment_order   + credit_pack; a plan order keeps a chosen level only on a per-seat plan
-- The old top-up packs (credit_packs) stay for workspaces on plans that are no longer sold.

-- Included credits per plan: ONE place, plans.ai_credits_per_month. Start 10,000 (owner 2026-10-13: the subscription must beat the
-- same money in packs); Pro 8,000 and Max 40,000 are placeholders until the owner confirms them.
update public.plans set ai_credits_per_month = 10000 where code = 'start';
update public.plans set ai_credits_per_month = 8000 where code = 'pro';
update public.plans set ai_credits_per_month = 40000 where code = 'max';

create table if not exists public.billing_config (
  key text primary key,
  value numeric not null,
  note text not null default ''
);
alter table public.billing_config enable row level security;
grant select on table public.billing_config to app_be;
drop policy if exists "billing_config_app_be_select" on public.billing_config;
create policy "billing_config_app_be_select" on public.billing_config for select to app_be using (key is not null);
insert into public.billing_config (key, value, note) values
  ('credit_usd_value', 0.00113, 'USD of model token cost that one credit is worth (= 1/885). THE definition of a credit: credits = ceil(cost_usd / this) per call.'),
  ('exchange_rate_vnd_per_usd', 26000, 'Input of credit_usd_value (documentation): VND per USD.'),
  ('target_margin', 0.40, 'Input of credit_usd_value (documentation): gross margin kept on token cost at the lowest revenue per included credit.'),
  ('min_revenue_vnd_per_credit', 49, 'Input of credit_usd_value (documentation): the lowest plan price / included credits, Start 490,000 / 10,000. Not shown to customers.')
on conflict (key) do update set value = excluded.value, note = excluded.note;

create or replace function public.credit_usd_value() returns numeric
language sql stable security definer set search_path = public as $$
  select value from public.billing_config where key = 'credit_usd_value';
$$;
revoke all on function public.credit_usd_value() from public, anon, authenticated;
grant execute on function public.credit_usd_value() to service_role, app_be;

-- Included credits per plan: ONE place, plans.ai_credits_per_month (owner final numbers: about twice what the same money buys in packs).
update public.plans set ai_credits_per_month = 10000 where code = 'start';
update public.plans set ai_credits_per_month = 20000 where code = 'pro';
update public.plans set ai_credits_per_month = 100000 where code = 'max';
update public.plans set ai_credits_per_month = 100000 where code = 'enterprise';
update public.plans set ai_credits_per_month = 8000 where code = 'team';

-- Team levels keep their prices; the included credits per seat double. The old catalogue never sold, so a level picked on it is simply cleared
-- (the workspace then gets the plan's smallest level until it picks again).
update public.workspaces w set tier_credits = null where exists (select 1 from public.plans p where p.code = w.plan_code and p.per_seat);
delete from public.plan_usage_tiers where plan_code = 'team';
insert into public.plan_usage_tiers (plan_code, credits_per_month, price_vnd, per_seat, sort) values
  ('team', 8000, 400000, true, 1), ('team', 16000, 800000, true, 2), ('team', 24000, 1200000, true, 3), ('team', 32000, 1600000, true, 4),
  ('team', 40000, 2000000, true, 5), ('team', 80000, 4000000, true, 6), ('team', 126000, 6300000, true, 7), ('team', 170000, 8500000, true, 8),
  ('team', 220000, 11000000, true, 9), ('team', 340000, 17000000, true, 10), ('team', 460000, 23000000, true, 11),
  ('team', 700000, 35000000, true, 12), ('team', 960000, 48000000, true, 13), ('team', 1600000, 80000000, true, 14);

alter table public.payment_orders drop constraint if exists payment_orders_kind_check;
alter table public.payment_orders
  add constraint payment_orders_kind_check check (kind in ('plan', 'upgrade', 'topup', 'credit_pack'));
alter table public.payment_order_requests drop constraint if exists payment_order_requests_kind_check;
alter table public.payment_order_requests
  add constraint payment_order_requests_kind_check check (kind in ('plan', 'renew', 'topup', 'upgrade', 'credit_pack'));

create table if not exists public.credit_pack_purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  order_id uuid not null unique references public.payment_orders (id),   -- one purchase per paid order: a retried webhook adds nothing
  credits bigint not null check (credits > 0),
  price_vnd bigint not null check (price_vnd >= 0),
  period date not null,                                                   -- first day of the month (Vietnam time) the credits count for
  purchased_at timestamptz not null default now()
);
create index if not exists credit_pack_purchases_period on public.credit_pack_purchases (workspace_id, period);

alter table public.credit_pack_purchases enable row level security;
drop policy if exists "credit_pack_purchases_manager_select" on public.credit_pack_purchases;
create policy "credit_pack_purchases_manager_select" on public.credit_pack_purchases for select to authenticated using (public.is_manager(workspace_id));
grant select on table public.credit_pack_purchases to app_be;
drop policy if exists "credit_pack_purchases_app_be_select" on public.credit_pack_purchases;
create policy "credit_pack_purchases_app_be_select" on public.credit_pack_purchases for select to app_be using (workspace_id is not null);

-- A level picked on an individual plan no longer exists: the plan's allowance is fixed.
update public.workspaces w set tier_credits = null, seat_count = null
where (w.tier_credits is not null or w.seat_count is not null)
  and not exists (select 1 from public.plans p where p.code = w.plan_code and p.per_seat);

-- ---------------------------------------------------------------- one month's credits
create or replace function public.ai_credit_period(p_workspace uuid, p_period date)
returns table (used numeric, base bigint, carry numeric, credits_limit bigint)
language sql stable security definer set search_path = public as $$
  with p as (
    select p_period as d,
           (p_period - interval '1 month')::date as pd,
           (p_period + interval '1 month')::date as nd
  ), u as (
    select
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as cost,
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.d), 0) as prev_cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace and e.kind <> 'guide'
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
revoke all on function public.ai_credit_period(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_credit_period(uuid, date) to service_role;

-- ---------------------------------------------------------------- settlement of a paid order
create or replace function public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  o public.payment_orders;
  p public.plans;
  w public.workspaces;
  base timestamptz;
  ts timestamptz := now();
  lot_credits bigint;
  cycle text;
begin
  select * into o from public.payment_orders where order_code = upper(p_order_code) for update;
  if not found then return 'unmatched'; end if;
  update public.sepay_transactions set matched_order_id = o.id where sepay_id = p_sepay_id;
  if o.status = 'paid' then return 'ignored'; end if;
  if o.status <> 'pending' or o.expires_at < ts then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'expired_payment', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
    return 'expired';
  end if;
  if p_amount < o.amount_vnd then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'underpaid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'expected', o.amount_vnd, 'sepay_id', p_sepay_id));
    return 'underpaid';
  end if;

  if o.kind = 'credit_pack' then
    lot_credits := (o.detail ->> 'credits')::bigint;
    if lot_credits is null or lot_credits <= 0 then
      insert into public.billing_events (workspace_id, kind, data)
        values (o.workspace_id, 'credit_pack_invalid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
      return 'unmatched';
    end if;
    update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
    insert into public.credit_pack_purchases (workspace_id, order_id, credits, price_vnd, period, purchased_at)
      values (o.workspace_id, o.id, lot_credits, o.amount_vnd, date_trunc('month', ts at time zone 'Asia/Ho_Chi_Minh')::date, ts)
      on conflict (order_id) do nothing;
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'kind', 'credit_pack', 'credits', lot_credits, 'sepay_id', p_sepay_id));
    return 'paid';
  end if;

  if o.kind = 'topup' then
    lot_credits := coalesce((o.detail ->> 'credits')::bigint, (select k.credits from public.credit_packs k where k.code = o.pack_code));
    if lot_credits is null or lot_credits <= 0 then
      insert into public.billing_events (workspace_id, kind, data)
        values (o.workspace_id, 'topup_invalid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
      return 'unmatched';
    end if;
    update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
    perform public.settle_credit_topups(o.workspace_id, true);
    insert into public.credit_topups (workspace_id, credits, credits_remaining, price_vnd, order_id, pack_code, purchased_at, expires_at)
      values (o.workspace_id, lot_credits, lot_credits, o.amount_vnd, o.id, o.pack_code, ts, ts + interval '12 months')
      on conflict (order_id) do nothing;
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'kind', 'topup', 'credits', lot_credits, 'sepay_id', p_sepay_id));
    return 'paid';
  end if;

  select * into p from public.plans where code = o.plan_code;
  select * into w from public.workspaces where id = o.workspace_id for update;
  update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
  if o.kind = 'upgrade' then
    update public.workspaces
      set plan_code = o.plan_code, tier_credits = null, seat_count = null,
          billed_monthly_vnd = coalesce((o.detail ->> 'toPrice')::bigint, p.price_vnd)
      where id = o.workspace_id;
  else
    cycle := coalesce(o.detail ->> 'cycle', case p.period when 'year' then 'annual' else 'monthly' end);
    base := case when w.status = 'active' and w.paid_until is not null and w.paid_until > ts then w.paid_until else ts end;
    update public.workspaces
      set status = 'active', plan_code = o.plan_code,
          paid_until = base + case cycle when 'annual' then interval '1 year' else interval '1 month' end,
          tier_credits = case when p.per_seat then nullif((o.detail ->> 'tierCredits')::bigint, 0) else null end,
          seat_count = case when p.per_seat then nullif((o.detail ->> 'seats')::int, 0) else null end,
          billing_cycle = cycle,
          billed_monthly_vnd = coalesce((o.detail ->> 'listMonthlyVnd')::bigint, p.price_vnd)
      where id = o.workspace_id;
  end if;
  insert into public.billing_events (workspace_id, kind, data)
    values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'plan', o.plan_code, 'kind', o.kind, 'sepay_id', p_sepay_id));
  return 'paid';
end;
$$;
revoke all on function public.settle_payment_order(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.settle_payment_order(text, bigint, bigint) to service_role, app_be;
