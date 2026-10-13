-- Loyalty ("Khách hàng thân thiết"): customers, programme, rewards, the points ledger, promotion campaigns and the public-check OTP.
-- Additive only: nothing here changes leads, conversations, orders, invoices or transactions. A customer is a new row that LINKS to them (loyalty_customer_links).
-- Balances come from the ledger only (view loyalty_balances); the ledger is append-only.

-- ---------------------------------------------------------------- programme (one per workspace)
create table public.loyalty_programs (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'),   -- public page /l/<slug>
  name text not null default '',
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,   -- earn rules, tiers, expiry, birthday, promo limits (resources/loyalty/defaults.json shape)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.loyalty_rewards (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9][a-z0-9_-]{0,38}$'),
  name text not null,
  kind text not null default 'voucher' check (kind in ('voucher', 'item', 'percent')),
  value_vnd bigint not null default 0 check (value_vnd >= 0),         -- cash value (voucher amount, price of the free item, estimated value of a % discount)
  percent int check (percent is null or percent between 1 and 100),
  points_cost int not null check (points_cost > 0),
  stock int check (stock is null or stock >= 0),                        -- null = unlimited
  per_customer_limit int check (per_customer_limit is null or per_customer_limit > 0),
  min_tier_key text,                                                    -- null = any tier
  note text not null default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (workspace_id, key)
);

-- ---------------------------------------------------------------- customers: ONE person, however many leads / chats they have
create table public.loyalty_customers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null default '',
  phone text,                                  -- normalised: 84xxxxxxxxx (src/lib/core.ts normaliseContact)
  email text,                                  -- lower case
  birthday date,
  tier_key text,                               -- the tier the customer holds now (changed only by the ledger code, which also announces the upgrade)
  tier_since timestamptz,
  joined_at timestamptz not null default now(),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index loyalty_customers_phone on public.loyalty_customers (workspace_id, phone) where phone is not null;
create unique index loyalty_customers_email on public.loyalty_customers (workspace_id, email) where email is not null;
create index loyalty_customers_ws on public.loyalty_customers (workspace_id, created_at desc);

-- Link table: a customer <-> the rows that already exist (lead id, conversation id, channel account such as "telegram:123"). Never a foreign key into those tables.
create table public.loyalty_customer_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers (id) on delete cascade,
  kind text not null check (kind in ('lead', 'conversation', 'channel')),
  ref text not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, ref)
);
create index loyalty_customer_links_customer on public.loyalty_customer_links (customer_id);

-- ---------------------------------------------------------------- ledger (append-only)
create table public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers (id) on delete cascade,
  kind text not null check (kind in ('earn', 'redeem', 'expire', 'adjust')),
  points int not null check (points <> 0),
  amount_vnd bigint,                           -- earn: the spend that earned the points; redeem: the cash value of the reward
  order_id uuid,                               -- reference to orders.id (no foreign key on purpose)
  invoice_id uuid,
  reward_id uuid references public.loyalty_rewards (id) on delete set null,
  work_item_id uuid,                           -- the gate decision behind this row
  ref text not null,                           -- idempotency key, e.g. "order:<id>", "redeem:<work item>", "expire:<customer>:<yyyy-mm-dd>"
  by_name text not null default 'NIVO',        -- who: "NIVO" (policy), a person's name, an API key name
  evidence text,
  expires_at timestamptz,                      -- earn rows only
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, ref),
  check ((kind = 'earn' and points > 0) or (kind in ('redeem', 'expire') and points < 0) or kind = 'adjust')
);
create index loyalty_ledger_customer on public.loyalty_ledger (customer_id, occurred_at desc);
create index loyalty_ledger_ws on public.loyalty_ledger (workspace_id, occurred_at desc);

create or replace function public.loyalty_ledger_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'loyalty_ledger is append-only (add an adjust row instead)';
end $$;
create trigger loyalty_ledger_no_update before update on public.loyalty_ledger for each row execute function public.loyalty_ledger_immutable();

-- Balances come from the ledger and nowhere else.
create view public.loyalty_balances with (security_invoker = true) as
select c.workspace_id, c.id as customer_id,
       coalesce(sum(l.points), 0)::int as points,
       coalesce(sum(l.amount_vnd) filter (where l.kind = 'earn'), 0)::bigint as lifetime_spend_vnd,
       coalesce(sum(l.points) filter (where l.kind = 'earn'), 0)::int as lifetime_earned,
       count(*) filter (where l.kind = 'earn' and l.order_id is not null)::int as visits,
       max(l.occurred_at) filter (where l.kind = 'earn') as last_visit_at
  from public.loyalty_customers c
  left join public.loyalty_ledger l on l.customer_id = c.id
 group by c.workspace_id, c.id;

-- ---------------------------------------------------------------- promotions: one campaign = ONE gate decision; the sends are per customer
create table public.loyalty_campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  segment jsonb not null default '{}'::jsonb,
  draft text not null default '',              -- the message with {ten_khach} {ten_shop}; OpenClaw writes it, the owner approves or edits it
  status text not null default 'draft' check (status in ('draft', 'waiting', 'sending', 'done', 'rejected', 'failed')),
  work_item_id uuid,
  recipients int not null default 0,
  draft_ms int,                                -- how long OpenClaw took to write the draft
  created_by text not null default '',
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index loyalty_campaigns_ws on public.loyalty_campaigns (workspace_id, created_at desc);

create table public.loyalty_sends (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  campaign_id uuid not null references public.loyalty_campaigns (id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers (id) on delete cascade,
  lead_id uuid,
  conversation_id uuid,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  body text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, customer_id)
);
create index loyalty_sends_open on public.loyalty_sends (workspace_id, created_at) where status = 'queued';

-- ---------------------------------------------------------------- public check page: one-time codes sent through the customer's own chat channel
create table public.loyalty_otps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers (id) on delete cascade,
  code_hash text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index loyalty_otps_customer on public.loyalty_otps (customer_id, created_at desc);

-- ---------------------------------------------------------------- access: members read, the server (service role) writes
do $$
declare t text;
begin
  foreach t in array array['loyalty_programs', 'loyalty_rewards', 'loyalty_customers', 'loyalty_customer_links', 'loyalty_ledger', 'loyalty_campaigns', 'loyalty_sends', 'loyalty_otps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
  foreach t in array array['loyalty_programs', 'loyalty_rewards', 'loyalty_customers', 'loyalty_customer_links', 'loyalty_ledger', 'loyalty_campaigns', 'loyalty_sends'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_read', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
-- loyalty_otps: service role only (no policy, no grant to authenticated).
revoke all on public.loyalty_balances from anon, authenticated;
grant select on public.loyalty_balances to authenticated, service_role;

-- ---------------------------------------------------------------- the one way points move
-- Locks the customer, refuses to take more points than the balance, takes the reward's stock and per-customer limit under the same lock, and is idempotent on (workspace, ref):
-- a repeated call with the same ref returns null and changes nothing.
create or replace function public.loyalty_post(
  p_workspace uuid, p_customer uuid, p_kind text, p_points int, p_ref text, p_by text,
  p_amount_vnd bigint default null, p_order_id uuid default null, p_invoice_id uuid default null, p_reward_id uuid default null,
  p_work_item_id uuid default null, p_evidence text default null, p_expires_at timestamptz default null, p_occurred_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_balance int;
  v_reward public.loyalty_rewards%rowtype;
begin
  perform 1 from public.loyalty_customers where id = p_customer and workspace_id = p_workspace for update;
  if not found then raise exception 'customer_not_found'; end if;
  if exists (select 1 from public.loyalty_ledger where workspace_id = p_workspace and ref = p_ref) then return null; end if;
  if p_points < 0 then
    select coalesce(sum(points), 0) into v_balance from public.loyalty_ledger where customer_id = p_customer;
    if v_balance + p_points < 0 then raise exception 'insufficient_points'; end if;
  end if;
  if p_kind = 'redeem' and p_reward_id is not null then
    select * into v_reward from public.loyalty_rewards where id = p_reward_id and workspace_id = p_workspace for update;
    if not found then raise exception 'reward_not_found'; end if;
    if not v_reward.active then raise exception 'reward_inactive'; end if;
    if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'out_of_stock'; end if;
    if v_reward.per_customer_limit is not null
       and (select count(*) from public.loyalty_ledger where customer_id = p_customer and reward_id = p_reward_id and kind = 'redeem') >= v_reward.per_customer_limit then
      raise exception 'limit_reached';
    end if;
    if v_reward.stock is not null then update public.loyalty_rewards set stock = stock - 1 where id = p_reward_id; end if;
  end if;
  insert into public.loyalty_ledger (workspace_id, customer_id, kind, points, amount_vnd, order_id, invoice_id, reward_id, work_item_id, ref, by_name, evidence, expires_at, occurred_at)
  values (p_workspace, p_customer, p_kind, p_points, p_amount_vnd, p_order_id, p_invoice_id, p_reward_id, p_work_item_id, p_ref, coalesce(nullif(p_by, ''), 'NIVO'), p_evidence, p_expires_at, coalesce(p_occurred_at, now()))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.loyalty_post(uuid, uuid, text, int, text, text, bigint, uuid, uuid, uuid, uuid, text, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.loyalty_post(uuid, uuid, text, int, text, text, bigint, uuid, uuid, uuid, uuid, text, timestamptz, timestamptz) to service_role;
