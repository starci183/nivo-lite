-- Workspace creation + paid plans (SePay bank transfer). Additive.
--   plans              the catalogue (read by everyone signed in)
--   workspaces         + status / plan_code / paid_until (billing columns writable by the server only)
--   payment_orders     one transfer to make: the order_code is the transfer content
--   sepay_transactions every raw SePay webhook payload, unique by SePay id (idempotency)
--   billing_events     small audit trail of what billing did
-- Members read their workspace's billing; every write goes through the service role (webhook + server actions).

-- ---------------------------------------------------------------- plans
create table public.plans (
  code text primary key,
  name_vi text not null,
  name_en text not null,
  price_vnd bigint not null check (price_vnd >= 0),
  period text not null check (period in ('month', 'year')),
  seats int not null check (seats > 0),
  features jsonb not null default '{"vi": [], "en": []}'::jsonb,   -- {"vi": ["..."], "en": ["..."]}
  sort int not null default 0,
  active boolean not null default true
);

-- TO_CONFIRM: the prices, seats and feature lists below are PLACEHOLDERS. The owner sets the real ones
-- (update public.plans set price_vnd = ... where code = ...).
insert into public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort) values
  ('starter', 'Khởi đầu', 'Starter', 990000, 'month', 3,                -- TO_CONFIRM price
    '{"vi": ["Tối đa 3 thành viên", "1 chatbot + AI bán hàng", "Duyệt việc trước khi AI làm"], "en": ["Up to 3 members", "1 chatbot + sales AI", "Approve work before AI acts"]}', 1),
  ('growth', 'Tăng trưởng', 'Growth', 2490000, 'month', 10,             -- TO_CONFIRM price
    '{"vi": ["Tối đa 10 thành viên", "Chatbot + AI bán hàng + AI kế toán", "Phân quyền chủ sở hữu, quản lý, nhân viên"], "en": ["Up to 10 members", "Chatbot + sales AI + accounting AI", "Owner, manager and staff roles"]}', 2)
on conflict (code) do nothing;

alter table public.plans enable row level security;
create policy plans_read on public.plans for select using (auth.uid() is not null);

-- ---------------------------------------------------------------- workspaces billing columns
-- Existing workspaces stay 'active' (default); the onboarding flow creates new ones as 'pending_payment'.
alter table public.workspaces
  add column status text not null default 'active' check (status in ('pending_payment', 'active', 'past_due', 'cancelled')),
  add column plan_code text references public.plans (code),
  add column paid_until timestamptz;

-- A signed-in user (even the owner) can never change billing columns: only the service role / SQL can.
create or replace function public.workspaces_billing_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (new.status is distinct from old.status or new.plan_code is distinct from old.plan_code or new.paid_until is distinct from old.paid_until) then
    raise exception 'billing_columns_server_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger workspaces_billing_guard before update on public.workspaces
  for each row execute function public.workspaces_billing_guard();

-- ---------------------------------------------------------------- payment orders
create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  plan_code text not null references public.plans (code),
  amount_vnd bigint not null check (amount_vnd >= 0),
  order_code text not null unique,                 -- e.g. NIVO8F3K2, the bank transfer content
  status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled')),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  sepay_transaction_id bigint unique,
  created_at timestamptz not null default now()
);
create index payment_orders_ws on public.payment_orders (workspace_id, created_at desc);

alter table public.payment_orders enable row level security;
create policy payment_orders_read on public.payment_orders for select
  using (public.is_member(workspace_id) or created_by = auth.uid());
alter publication supabase_realtime add table public.payment_orders;

-- ---------------------------------------------------------------- raw SePay payloads
create table public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  sepay_id bigint not null unique,                 -- SePay's own transaction id: the idempotency key
  payload jsonb not null,
  transfer_amount bigint,
  content text,
  status text not null default 'received' check (status in ('received', 'paid', 'underpaid', 'expired', 'unmatched', 'ignored')),
  matched_order_id uuid references public.payment_orders (id) on delete set null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);
create index sepay_transactions_review on public.sepay_transactions (status, received_at desc);

alter table public.sepay_transactions enable row level security;
-- Owners/managers see transfers tied to one of their orders (underpaid / expired); fully unmatched ones are platform-level.
create policy sepay_transactions_read on public.sepay_transactions for select
  using (exists (select 1 from public.payment_orders o where o.id = matched_order_id and public.is_manager(o.workspace_id)));

-- ---------------------------------------------------------------- billing events
create table public.billing_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces (id) on delete cascade,
  kind text not null,                              -- paid | underpaid | expired_payment
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
create policy billing_events_read on public.billing_events for select using (workspace_id is not null and public.is_manager(workspace_id));

-- ---------------------------------------------------------------- settlement (service role only)
-- Atomically: lock the order, check it is pending + not expired + fully paid, mark it paid, activate the workspace.
-- Returns the outcome so the webhook can record it on the transaction row.
create or replace function public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
  o public.payment_orders;
  p public.plans;
  w public.workspaces;
  base timestamptz;
begin
  select * into o from public.payment_orders where order_code = upper(p_order_code) for update;
  if not found then return 'unmatched'; end if;
  update public.sepay_transactions set matched_order_id = o.id where sepay_id = p_sepay_id;
  if o.status = 'paid' then return 'ignored'; end if;                       -- already settled by another transfer
  if o.status <> 'pending' or o.expires_at < now() then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'expired_payment', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
    return 'expired';
  end if;
  if p_amount < o.amount_vnd then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'underpaid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'expected', o.amount_vnd, 'sepay_id', p_sepay_id));
    return 'underpaid';
  end if;
  select * into p from public.plans where code = o.plan_code;
  select * into w from public.workspaces where id = o.workspace_id for update;
  base := case when w.status = 'active' and w.paid_until is not null and w.paid_until > now() then w.paid_until else now() end;
  update public.payment_orders set status = 'paid', paid_at = now(), sepay_transaction_id = p_sepay_id where id = o.id;
  update public.workspaces
    set status = 'active', plan_code = o.plan_code,
        paid_until = base + case p.period when 'year' then interval '1 year' else interval '1 month' end
    where id = o.workspace_id;
  insert into public.billing_events (workspace_id, kind, data)
    values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'plan', o.plan_code, 'sepay_id', p_sepay_id));
  return 'paid';
end;
$$;
revoke all on function public.settle_payment_order(text, bigint, bigint) from public, anon, authenticated;
grant execute on function public.settle_payment_order(text, bigint, bigint) to service_role;
