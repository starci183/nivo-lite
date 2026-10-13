-- NIVO pricing 2026-10 (owner offer). Additive; existing subscribers are left exactly as they are.
--   Credits are an INTERNAL allowance unit: no table here converts a credit to money. Prices belong to plans and usage tiers only.
--   The cost-based spend (a call spends cost_usd x 250 credits) is NOT touched: ai_credit_period keeps the same arithmetic.
--
--   plans              + price_annual_vnd, annual_discount_pct, promo_price_vnd, promo_months, storage_gb, listed, individual, per_seat
--   plan_usage_tiers   the bigger monthly allowances a plan can be bought with (per workspace, or per seat for Team)
--   workspaces         + tier_credits, seat_count, billing_cycle, billed_monthly_vnd (what the workspace bought)
--   payment_order_requests + cycle, tier_credits, seats (what the manager asked to buy)
--   workspace_storage_bytes()  bytes a workspace keeps in the knowledge and media buckets (quota check)
--
-- Plans: start / pro / max (Individual, 1 person), team (per seat), enterprise (contract). Subscribers of the old catalogue keep
-- their plan, price, seats and allowance: the old `pro` and `max` rows move to the hidden codes `pro_v1` / `max_v1` (workspaces and
-- orders follow), `starter` stays as it is; all three are `listed = false`, so they are not sold any more but still work and renew.
-- Moving existing subscribers onto the new catalogue and Team SSO/SAML/MFA are deferred (owner, 2026-10-13).

alter table public.plans
  add column if not exists price_annual_vnd bigint check (price_annual_vnd is null or price_annual_vnd >= 0),   -- one year paid at once; null = no annual
  add column if not exists annual_discount_pct int check (annual_discount_pct is null or annual_discount_pct between 0 and 90),
  add column if not exists promo_price_vnd bigint check (promo_price_vnd is null or promo_price_vnd >= 0),      -- monthly price of the intro months
  add column if not exists promo_months int check (promo_months is null or promo_months > 0),
  add column if not exists storage_gb int check (storage_gb is null or storage_gb > 0),                         -- null = not capped
  add column if not exists listed boolean not null default true,                                                -- false = still usable by who has it, not sold
  add column if not exists individual boolean not null default false,                                           -- one person only: no invitations
  add column if not exists per_seat boolean not null default false;                                             -- the price is per seat

create table if not exists public.plan_usage_tiers (
  plan_code text not null references public.plans (code) on delete cascade,
  credits_per_month bigint not null check (credits_per_month > 0),
  price_vnd bigint not null check (price_vnd >= 0),            -- per month, per seat when per_seat
  per_seat boolean not null default false,
  sort int not null default 0,
  primary key (plan_code, credits_per_month)
);
alter table public.plan_usage_tiers enable row level security;
drop policy if exists "plan_usage_tiers_authenticated_select" on public.plan_usage_tiers;
create policy "plan_usage_tiers_authenticated_select" on public.plan_usage_tiers for select to authenticated using (auth.uid() is not null);
grant select on table public.plan_usage_tiers to app_be;
drop policy if exists "plan_usage_tiers_app_be_select" on public.plan_usage_tiers;
create policy "plan_usage_tiers_app_be_select" on public.plan_usage_tiers for select to app_be using (plan_code is not null);

-- ---------------------------------------------------------------- what a workspace bought
alter table public.workspaces
  add column if not exists tier_credits bigint check (tier_credits is null or tier_credits > 0),   -- chosen monthly allowance (per seat for Team); null = the plan's own
  add column if not exists seat_count int check (seat_count is null or seat_count > 0),             -- paid seats of a per-seat plan; null = not tracked
  add column if not exists billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'annual')),
  add column if not exists billed_monthly_vnd bigint check (billed_monthly_vnd is null or billed_monthly_vnd >= 0);  -- list monthly price of what was bought

create or replace function public.workspaces_billing_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (
       new.status is distinct from old.status or new.plan_code is distinct from old.plan_code or new.paid_until is distinct from old.paid_until
    or new.tier_credits is distinct from old.tier_credits or new.seat_count is distinct from old.seat_count
    or new.billing_cycle is distinct from old.billing_cycle or new.billed_monthly_vnd is distinct from old.billed_monthly_vnd) then
    raise exception 'billing_columns_server_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

alter table public.payment_order_requests
  add column if not exists cycle text check (cycle is null or cycle in ('monthly', 'annual')),
  add column if not exists tier_credits bigint check (tier_credits is null or tier_credits > 0),
  add column if not exists seats int check (seats is null or seats between 1 and 1000);

-- ---------------------------------------------------------------- the old catalogue stays for who has it
insert into public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort, active, ai_credits_per_month, is_custom, credits_rollover, listed)
select 'pro_v1', name_vi, name_en, price_vnd, period, seats, features, 102, true, ai_credits_per_month, is_custom, credits_rollover, false
from public.plans where code = 'pro'
on conflict (code) do nothing;
insert into public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort, active, ai_credits_per_month, is_custom, credits_rollover, listed)
select 'max_v1', name_vi, name_en, price_vnd, period, seats, features, 103, true, ai_credits_per_month, is_custom, credits_rollover, false
from public.plans where code = 'max'
on conflict (code) do nothing;

-- Only the first run moves them (the old rows are recognisable by their old price); a re-run finds nothing to move.
update public.workspaces set plan_code = 'pro_v1' where plan_code = 'pro' and exists (select 1 from public.plans where code = 'pro' and price_vnd = 1499000);
update public.payment_orders set plan_code = 'pro_v1' where plan_code = 'pro' and exists (select 1 from public.plans where code = 'pro' and price_vnd = 1499000);
update public.workspaces set plan_code = 'max_v1' where plan_code = 'max' and exists (select 1 from public.plans where code = 'max' and price_vnd = 4999000);
update public.payment_orders set plan_code = 'max_v1' where plan_code = 'max' and exists (select 1 from public.plans where code = 'max' and price_vnd = 4999000);
update public.plans set listed = false, sort = 101 where code = 'starter';

-- ---------------------------------------------------------------- the new catalogue
insert into public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort, active, ai_credits_per_month, is_custom,
                          credits_rollover, listed, individual, per_seat, price_annual_vnd, annual_discount_pct, promo_price_vnd, promo_months, storage_gb) values
  ('start', 'Start', 'Start', 490000, 'month', 1,
    '{"vi": ["Kết nối (connectors)", "Workspace agent cho quy trình tùy chỉnh", "Bộ nhớ mở rộng", "Agent tự động chạy liên tục", "Công cụ tài chính và dữ liệu"], "en": ["Connectors", "Workspace agents for custom workflows", "Extended memory", "Always-on automation agents", "Finance and data tools"]}',
    1, true, 4000, false, false, true, true, false, 4998000, 15, 245000, 3, 10),
  ('pro', 'Pro', 'Pro', 990000, 'month', 1,
    '{"vi": ["Mọi thứ trong Start", "Giới hạn sử dụng cao hơn", "Nghiên cứu chuyên sâu (tự đặt mức dùng)", "Bộ nhớ tối đa"], "en": ["Everything in Start", "Higher rate limits", "Deep research (set your own usage)", "Maximum memory"]}',
    2, true, 8000, false, true, true, true, false, 10098000, 15, 792000, 3, 20),
  ('max', 'Max', 'Max', 4990000, 'month', 1,
    '{"vi": ["Mọi thứ trong Pro", "Mức sử dụng cao hơn nhiều", "Video 1080p", "Truy cập ưu tiên", "Agent tự động từ đầu đến cuối", "Truy cập sớm tính năng mới", "Nghiên cứu chuyên sâu quy mô lớn"], "en": ["Everything in Pro", "Much higher usage", "1080p video", "Priority access", "End-to-end automation agents", "Early access to new features", "Deep research at scale"]}',
    3, true, 40000, false, true, true, true, false, 50898000, 15, null, null, 100),
  ('team', 'Team', 'Team', 400000, 'month', 1000,
    '{"vi": ["Quản lý ghế và phân quyền (RBAC)", "Lưu trữ dữ liệu tùy chỉnh", "Thanh toán và quản trị tập trung", "Nhiều loại ghế trong cùng một nhóm"], "en": ["Seat management and RBAC", "Custom data storage", "Central billing and admin", "Mixed seat types in one team"]}',
    4, true, 4000, false, false, true, false, true, null, null, null, null, null),
  ('enterprise', 'Enterprise', 'Enterprise', 0, 'month', 1000,
    '{"vi": ["Số ghế và mức dùng theo hợp đồng", "Giới hạn chi tiêu theo người dùng và tổ chức", "Phân tích sử dụng và kiểm soát chi tiêu", "Kiểm soát lưu giữ dữ liệu", "Hỗ trợ triển khai riêng"], "en": ["Seats and usage by contract", "Spend limits per user and organisation", "Usage analytics and spend control", "Data-retention controls", "Dedicated onboarding"]}',
    5, true, 40000, true, false, true, false, false, null, null, null, null, null)
on conflict (code) do update set
  name_vi = excluded.name_vi, name_en = excluded.name_en, price_vnd = excluded.price_vnd, period = excluded.period, seats = excluded.seats,
  features = excluded.features, sort = excluded.sort, active = excluded.active, ai_credits_per_month = excluded.ai_credits_per_month,
  is_custom = excluded.is_custom, credits_rollover = excluded.credits_rollover, listed = excluded.listed, individual = excluded.individual,
  per_seat = excluded.per_seat, price_annual_vnd = excluded.price_annual_vnd, annual_discount_pct = excluded.annual_discount_pct,
  promo_price_vnd = excluded.promo_price_vnd, promo_months = excluded.promo_months, storage_gb = excluded.storage_gb;

insert into public.plan_usage_tiers (plan_code, credits_per_month, price_vnd, per_seat, sort) values
  ('pro', 8000, 800000, false, 1), ('pro', 12000, 1200000, false, 2), ('pro', 16000, 1600000, false, 3), ('pro', 20000, 2000000, false, 4),
  ('max', 40000, 4000000, false, 1), ('max', 63000, 6300000, false, 2), ('max', 85000, 8500000, false, 3), ('max', 110000, 11000000, false, 4),
  ('max', 170000, 17000000, false, 5),
  ('team', 4000, 400000, true, 1), ('team', 8000, 800000, true, 2), ('team', 12000, 1200000, true, 3), ('team', 16000, 1600000, true, 4),
  ('team', 20000, 2000000, true, 5), ('team', 40000, 4000000, true, 6), ('team', 63000, 6300000, true, 7), ('team', 85000, 8500000, true, 8),
  ('team', 110000, 11000000, true, 9), ('team', 170000, 17000000, true, 10), ('team', 230000, 23000000, true, 11),
  ('team', 350000, 35000000, true, 12), ('team', 480000, 48000000, true, 13), ('team', 800000, 80000000, true, 14)
on conflict (plan_code, credits_per_month) do update set price_vnd = excluded.price_vnd, per_seat = excluded.per_seat, sort = excluded.sort;

-- ---------------------------------------------------------------- one month's credits (same arithmetic; the allowance may be a chosen tier)
create or replace function public.ai_credit_period(p_workspace uuid, p_period date)
returns table (used numeric, base bigint, carry numeric, credits_limit bigint)
language sql stable security definer set search_path = public as $$
  with p as (
    select p_period as d,
           (p_period - interval '1 month')::date as pd,
           (p_period + interval '1 month')::date as nd
  ), u as (
    select
      coalesce(sum(e.cost_usd) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as cost,
      coalesce(sum(e.cost_usd) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.d), 0) as prev_cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace and e.kind <> 'guide'
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.pd
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.nd
  ), b as (
    select
      p.d, p.pd, w.created_at, o.credits_limit as own_limit, pl.credits_rollover,
      coalesce(
        o.credits_limit,
        case when w.tier_credits is not null then w.tier_credits * greatest(coalesce(w.seat_count, 1), 1) end,
        pl.ai_credits_per_month
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
            - (select u.prev_cost from u) * 250))
        else 0
      end as carry
    from b
  )
  select round(u.cost * 250, 2), c.base, c.carry,
         case when c.base is null then null else floor(c.base + c.carry)::bigint end
  from c cross join u;
$$;
revoke all on function public.ai_credit_period(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_credit_period(uuid, date) to service_role;

-- ---------------------------------------------------------------- storage kept by a workspace
create or replace function public.workspace_storage_bytes(p_workspace uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)::bigint
  from storage.objects o
  where o.bucket_id in ('knowledge-uploads', 'media', 'videos')
    and split_part(o.name, '/', 1) = p_workspace::text;
$$;
revoke all on function public.workspace_storage_bytes(uuid) from public, anon, authenticated;
grant execute on function public.workspace_storage_bytes(uuid) to app_be, service_role;

-- ---------------------------------------------------------------- settlement of a paid order
-- As 20261012101100_credit-topups.sql, plus: a plan order extends paid_until by the cycle it was sold for (annual = one year) and
-- records what the workspace bought (tier, seats, cycle, list monthly price); an upgrade clears the tier of the old plan.
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
          tier_credits = nullif((o.detail ->> 'tierCredits')::bigint, 0),
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
