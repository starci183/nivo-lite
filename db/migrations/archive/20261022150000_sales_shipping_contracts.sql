-- Sales automations "Báo giao hàng" (delivery_notice, event order.shipped) and "Nhắc gia hạn hợp đồng" (contract_renewal, event contract.expiring).
--   1. orders get a shipping state: shipped_at / carrier / tracking_code (set once, by the sales workbench action "Đánh dấu đã giao cho vận chuyển").
--   2. contracts: a minimal recurring-contract model (customer or lead, plan, start, end, amount, status) listed in the sales workbench.
-- Members read; ALL writes go through the service role (server actions check the session first).

alter table public.orders
  add column if not exists shipped_at timestamptz,
  add column if not exists carrier text,
  add column if not exists tracking_code text;

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  lead_id uuid references public.leads (id) on delete set null,
  customer_name text not null,
  plan text not null default '',
  starts_on date not null,
  ends_on date not null,
  amount_vnd bigint check (amount_vnd is null or amount_vnd >= 0),
  status text not null default 'active' check (status in ('active', 'ended', 'cancelled')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists contracts_ws_end on public.contracts (workspace_id, status, ends_on);

alter table public.contracts enable row level security;
drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select to authenticated using (public.is_member(workspace_id));
revoke all on public.contracts from anon, authenticated;
grant select on public.contracts to authenticated;
grant all on public.contracts to service_role;
