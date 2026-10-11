-- Credit top-ups, plan upgrades and the "Credit & gói" page. Additive and idempotent (safe to re-run).
--
--   credit_packs         the top-up catalogue (server data: the app never trusts a price from the browser)
--   credit_topups        one lot per paid top-up order: credits, credits_remaining, 12-month expiry, unique per order
--   credit_topup_draws   per workspace and month: how much of that month's overage was already settled against the lots
--   payment_orders       + kind ('plan' | 'upgrade' | 'topup'), pack_code, detail (snapshot of what was sold)
--   ai_credit_period     one month's credits used and allowance (incl. rollover) - the single source for status and settle
--   ai_quota_status      + topup_balance: top-up credits still spendable right now
--   settle_credit_topups the draw (below), run in the same transaction as every usage insert
--   settle_payment_order handles the three order kinds
--
-- SPEND ORDER ("monthly allowance first, then top-ups, oldest expiring first") - the chosen algorithm
--   Usage is recorded as events (ai_usage_events) and never rewritten. For a month P:
--       used(P)   = sum(cost_usd) x 250 of the month's events (guide rows excluded)
--       limit(P)  = the plan allowance + the credits carried from last month (floor, exactly as ai_quota_status always had)
--       over(P)   = ceil(max(0, used(P) - limit(P)))          the part of the month's usage the allowance could not cover
--   Only `over` is ever paid from top-ups. Unused top-up credits therefore survive month boundaries untouched: a month that
--   stays inside its allowance has over = 0 and draws nothing.
--   `settle_credit_topups(ws)` moves `over` out of the lots: it takes the delta  over(P) - drawn(P)  from the workspace's lots
--   in order of expiry (earliest expiry first, then purchase time) and records drawn(P) = over(P). The delta form makes it
--   idempotent: running it twice, or after every single event, converges to the same state and never draws twice.
--   Overage no lot can cover (an in-flight call finishing after the balance hit zero) is written off (credit_topup_draws.unfunded),
--   never carried to a lot bought later, so a future purchase is not charged retroactively.
--   Concurrency: every settle first takes a per-workspace advisory transaction lock, then locks the lots (FOR UPDATE) in draw
--   order, and recomputes `over` from the committed events under that lock. Two parallel usage inserts therefore serialise, the
--   second sees the first's draw, and the total drawn equals the overage exactly. The draw runs in an AFTER INSERT trigger on
--   ai_usage_events, so it is in the usage write's own transaction and cannot be forgotten by a new writer. A purchase settles
--   first (forced, writing off older overage) and only then inserts its lot, in one transaction with marking the order paid.
--   The balance a reader sees needs no lock: topup_balance = lots still open - (over - drawn), the part of the overage that
--   has been spent but not yet drawn is already subtracted, so a stale read can only be too low, never too high.
--   The page and blockedBy treat "allowance used up AND topup_balance = 0" as exceeded.
--   Expiry: a lot stops being spendable at expires_at (purchased_at + 12 months); what was drawn from it before stays drawn.

-- ---------------------------------------------------------------- catalogue
create table if not exists public.credit_packs (
  code text primary key,
  credits bigint not null check (credits > 0),
  price_vnd bigint not null check (price_vnd > 0),
  sort int not null default 0,
  active boolean not null default true
);
-- 1,000 credits at par with Starter (299 VND a credit); 3,000 at -5%; 10,000 at -10%.
insert into public.credit_packs (code, credits, price_vnd, sort, active) values
  ('credits_1000', 1000, 299000, 1, true),
  ('credits_3000', 3000, 849000, 2, true),
  ('credits_10000', 10000, 2690000, 3, true)
on conflict (code) do update set credits = excluded.credits, price_vnd = excluded.price_vnd, sort = excluded.sort, active = excluded.active;

alter table public.credit_packs enable row level security;
drop policy if exists credit_packs_read on public.credit_packs;
create policy credit_packs_read on public.credit_packs for select using (auth.uid() is not null);

-- ---------------------------------------------------------------- orders
-- Existing columns: id, workspace_id, created_by, plan_code (not null), amount_vnd, order_code (unique), status, expires_at,
-- paid_at, sepay_transaction_id, created_at. A top-up order keeps plan_code = the workspace's current plan (the column stays not null).
alter table public.payment_orders
  add column if not exists kind text not null default 'plan' check (kind in ('plan', 'upgrade', 'topup')),
  add column if not exists pack_code text references public.credit_packs (code),
  add column if not exists detail jsonb not null default '{}'::jsonb;   -- what was sold, frozen at order time (credits; proration inputs)

-- ---------------------------------------------------------------- lots
create table if not exists public.credit_topups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  credits bigint not null check (credits > 0),
  credits_remaining bigint not null check (credits_remaining >= 0 and credits_remaining <= credits),
  price_vnd bigint not null check (price_vnd >= 0),
  order_id uuid not null unique references public.payment_orders (id),   -- one lot per paid order: the webhook is idempotent on this
  pack_code text,
  purchased_at timestamptz not null default now(),
  expires_at timestamptz not null,                                       -- purchased_at + 12 months (set by settle_payment_order)
  check (expires_at > purchased_at)
);
create index if not exists credit_topups_open on public.credit_topups (workspace_id, expires_at) where credits_remaining > 0;

alter table public.credit_topups enable row level security;
drop policy if exists credit_topups_read on public.credit_topups;
create policy credit_topups_read on public.credit_topups for select using (public.is_manager(workspace_id));

create table if not exists public.credit_topup_draws (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period date not null,                          -- first day of the month (Vietnam time)
  drawn bigint not null default 0 check (drawn >= 0),       -- overage of that month already settled (from lots or written off)
  unfunded bigint not null default 0 check (unfunded >= 0), -- the part of `drawn` no lot could cover
  updated_at timestamptz not null default now(),
  primary key (workspace_id, period)
);
alter table public.credit_topup_draws enable row level security;
drop policy if exists credit_topup_draws_read on public.credit_topup_draws;
create policy credit_topup_draws_read on public.credit_topup_draws for select using (public.is_manager(workspace_id));

-- ---------------------------------------------------------------- one month's credits
-- Same arithmetic as 20261016100000_credit_bonus_rollover.sql, for any month: used, allowance, carry from the month before.
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
      coalesce(o.credits_limit, pl.ai_credits_per_month) as base
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

-- ---------------------------------------------------------------- the draw
create or replace function public.settle_credit_topups(p_workspace uuid, p_force boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  cur date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date;
  per date;
  r record;
  lot record;
  ovr bigint;
  already bigint;
  need bigint;
  take bigint;
  total bigint := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('credit_topups:' || p_workspace::text, 0));
  -- Nothing to draw from: skip (a purchase passes p_force to also write the older overage off before its lot exists).
  if not p_force and not exists (
    select 1 from public.credit_topups where workspace_id = p_workspace and credits_remaining > 0 and expires_at > now()
  ) then
    return 0;
  end if;
  -- Last month too, so an event that landed just before midnight is not left behind. Oldest month first.
  foreach per in array array[(cur - interval '1 month')::date, cur] loop
    select * into r from public.ai_credit_period(p_workspace, per);
    if r.credits_limit is null then continue; end if;                     -- unlimited allowance: nothing is ever over
    ovr := ceil(greatest(0, r.used - r.credits_limit))::bigint;
    select coalesce((select d.drawn from public.credit_topup_draws d where d.workspace_id = p_workspace and d.period = per), 0) into already;
    need := ovr - already;
    if need <= 0 then continue; end if;
    for lot in
      select id, credits_remaining from public.credit_topups
      where workspace_id = p_workspace and credits_remaining > 0 and expires_at > now()
      order by expires_at, purchased_at, id
      for update
    loop
      exit when need <= 0;
      take := least(need, lot.credits_remaining);
      update public.credit_topups set credits_remaining = credits_remaining - take where id = lot.id;
      need := need - take;
      total := total + take;
    end loop;
    insert into public.credit_topup_draws (workspace_id, period, drawn, unfunded)
      values (p_workspace, per, ovr, need)
      on conflict (workspace_id, period) do update
        set drawn = excluded.drawn, unfunded = public.credit_topup_draws.unfunded + excluded.unfunded, updated_at = now();
  end loop;
  return total;
end;
$$;
revoke all on function public.settle_credit_topups(uuid, boolean) from public, anon, authenticated;
grant execute on function public.settle_credit_topups(uuid, boolean) to service_role;

-- Runs inside the usage write. The cheap checks come first; a failure of the draw must never lose the usage row itself.
create or replace function public.ai_usage_events_settle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.kind = 'guide' or new.cost_usd <= 0 then return null; end if;
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
drop trigger if exists ai_usage_events_settle on public.ai_usage_events;
create trigger ai_usage_events_settle after insert on public.ai_usage_events
  for each row execute function public.ai_usage_events_settle();

-- ---------------------------------------------------------------- this month vs allowance, now with the top-up balance
drop function if exists public.ai_quota_status(uuid);
create function public.ai_quota_status(p_workspace uuid)
returns table (
  period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric,
  messages_limit int, tokens_limit bigint, fallback_reply text,
  credits_used numeric, credits_limit bigint, credits_carried numeric, topup_balance bigint
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
revoke all on function public.ai_quota_status(uuid) from public, anon, authenticated;
grant execute on function public.ai_quota_status(uuid) to service_role;

-- ---------------------------------------------------------------- settlement of a paid order (service role only)
-- Atomically: lock the order, check it is pending + not expired + fully paid, mark it paid, then by kind:
--   plan     activate the workspace and extend paid_until by one period (unchanged behaviour)
--   upgrade  switch plan_code at once; status and paid_until are NOT touched (the buyer paid only the difference for the rest of
--            the period already bought). If the workspace is already on that plan the payment is recorded and nothing else changes.
--   topup    settle older overage (forced), then insert the lot - once: the order is marked paid in the same transaction and
--            credit_topups.order_id is unique, so a retried webhook or a second transfer ("ignored" below) adds nothing.
create or replace function public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  o public.payment_orders;
  p public.plans;
  w public.workspaces;
  base timestamptz;
  ts timestamptz := now();
  lot_credits bigint;
begin
  select * into o from public.payment_orders where order_code = upper(p_order_code) for update;
  if not found then return 'unmatched'; end if;
  update public.sepay_transactions set matched_order_id = o.id where sepay_id = p_sepay_id;
  if o.status = 'paid' then return 'ignored'; end if;                       -- already settled by another transfer
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
      -- A top-up order with no known size cannot be fulfilled: leave it pending and let support look at the transfer.
      insert into public.billing_events (workspace_id, kind, data)
        values (o.workspace_id, 'topup_invalid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
      return 'unmatched';
    end if;
    update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
    perform public.settle_credit_topups(o.workspace_id, true);               -- older overage is written off, never charged to this lot
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
    update public.workspaces set plan_code = o.plan_code where id = o.workspace_id;
  else
    base := case when w.status = 'active' and w.paid_until is not null and w.paid_until > ts then w.paid_until else ts end;
    update public.workspaces
      set status = 'active', plan_code = o.plan_code,
          paid_until = base + case p.period when 'year' then interval '1 year' else interval '1 month' end
      where id = o.workspace_id;
  end if;
  insert into public.billing_events (workspace_id, kind, data)
    values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'plan', o.plan_code, 'kind', o.kind, 'sepay_id', p_sepay_id));
  return 'paid';
end;
$$;
revoke all on function public.settle_payment_order(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.settle_payment_order(text, bigint, bigint) to service_role;
