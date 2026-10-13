-- Inventory module ("Kho & nhập hàng"): items, locations, stock levels, movements, suppliers, purchase orders, recipes.
-- Generic for any business (café ingredients, retail goods, building materials, spa consumables).
-- Every table has workspace_id and RLS: members read; ALL writes go through the service role (the app's server code checks the session first)
-- and through inventory_apply_movement(), the one door that changes a quantity (row-locked, idempotent by dedupe_key).

create table public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index inventory_locations_one_default on public.inventory_locations (workspace_id) where is_default;
create index inventory_locations_ws on public.inventory_locations (workspace_id);

create table public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  contact_name text not null default '',
  email text,
  phone text,
  zalo text,
  channel text not null default 'email' check (channel in ('email', 'zalo', 'phone')),
  lead_time_days int not null default 2 check (lead_time_days >= 0),
  payment_terms text not null default '',
  note text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index inventory_suppliers_ws on public.inventory_suppliers (workspace_id);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  sku text not null,
  name text not null,
  unit text not null default 'cái',                       -- the base unit all quantities are kept in
  units jsonb not null default '[]'::jsonb,               -- other units: [{ "unit": "thùng", "factor": 24 }] = 1 thùng is 24 base units
  category text not null default '',
  cost_vnd numeric(14, 2) not null default 0,             -- weighted average cost per base unit
  sell_price_vnd numeric(14, 2),
  reorder_point numeric(16, 3) not null default 0,        -- at or below this: low stock
  reorder_qty numeric(16, 3) not null default 0,          -- the usual quantity per purchase order
  supplier_id uuid references public.inventory_suppliers (id) on delete set null,
  aliases text[] not null default '{}',                   -- other names an order line may use
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, sku)
);
create index inventory_items_ws on public.inventory_items (workspace_id, active);

create table public.inventory_stock_levels (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  location_id uuid not null references public.inventory_locations (id) on delete cascade,
  qty numeric(16, 3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (item_id, location_id)
);
create index inventory_stock_levels_ws on public.inventory_stock_levels (workspace_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  location_id uuid not null references public.inventory_locations (id) on delete cascade,
  kind text not null check (kind in ('in', 'out', 'adjust', 'transfer')),
  qty numeric(16, 3) not null,                            -- signed change in base units
  qty_after numeric(16, 3) not null,
  unit_cost_vnd numeric(14, 2),
  reason text not null default '',
  ref_type text not null default 'manual' check (ref_type in ('manual', 'order', 'po', 'count', 'import', 'transfer')),
  ref_id text,
  ref_label text,                                         -- "DH-20261010-1234", "PO-202610-0001"
  by_name text not null default 'NIVO',
  evidence text,
  dedupe_key text,
  created_at timestamptz not null default now()
);
create unique index inventory_movements_dedupe on public.inventory_movements (workspace_id, dedupe_key) where dedupe_key is not null;
create index inventory_movements_ws on public.inventory_movements (workspace_id, created_at desc);
create index inventory_movements_item on public.inventory_movements (item_id, created_at desc);

create table public.inventory_recipes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,                                     -- the product as it appears on an order: "cà phê sữa"
  aliases text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index inventory_recipes_ws on public.inventory_recipes (workspace_id);

create table public.inventory_recipe_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  recipe_id uuid not null references public.inventory_recipes (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete cascade,
  qty numeric(16, 3) not null check (qty > 0)             -- in the item's base unit, per ONE product
);
create index inventory_recipe_lines_recipe on public.inventory_recipe_lines (recipe_id);

create table public.inventory_purchase_orders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  po_no text not null,
  supplier_id uuid references public.inventory_suppliers (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'waiting_approval', 'sent', 'partially_received', 'received', 'cancelled')),
  total_vnd numeric(16, 0) not null default 0,
  expected_at date,
  message text not null default '',                       -- the order message to the supplier (written by OpenClaw, editable)
  sent_at timestamptz,
  sent_via text check (sent_via in ('email', 'copy')),    -- email: really sent by SMTP; copy: approved, the owner sends the copied message (Zalo, phone)
  send_note text,
  work_item_id uuid,                                      -- the send_purchase_order decision
  note text not null default '',
  source text not null default 'manual' check (source in ('auto', 'manual')),
  created_by text not null default 'NIVO',
  reminders int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, po_no)
);
create index inventory_po_ws on public.inventory_purchase_orders (workspace_id, status);

create table public.inventory_po_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  po_id uuid not null references public.inventory_purchase_orders (id) on delete cascade,
  item_id uuid not null references public.inventory_items (id) on delete restrict,
  qty_ordered numeric(16, 3) not null check (qty_ordered > 0),
  qty_received numeric(16, 3) not null default 0,
  unit_cost_vnd numeric(14, 2) not null default 0
);
create index inventory_po_lines_po on public.inventory_po_lines (po_id);

create table public.inventory_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  po_id uuid not null references public.inventory_purchase_orders (id) on delete cascade,
  invoice_no text,
  total_vnd numeric(16, 0) not null default 0,
  note text not null default '',
  received_by text not null default '',
  created_at timestamptz not null default now()
);
create index inventory_receipts_po on public.inventory_receipts (po_id);

-- ---------------------------------------------------------------- RLS: members read, the service role writes
do $$
declare t text;
begin
  foreach t in array array['inventory_locations', 'inventory_suppliers', 'inventory_items', 'inventory_stock_levels', 'inventory_movements',
                           'inventory_recipes', 'inventory_recipe_lines', 'inventory_purchase_orders', 'inventory_po_lines', 'inventory_receipts']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(workspace_id))', t || '_read', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- the one door that changes a quantity
-- Locks the item row (so two movements of the same item never interleave), applies the signed delta at the location, records the movement with the
-- quantity after, and for a purchase receipt (kind 'in' with a unit cost) moves the item's cost to the weighted average.
-- Idempotent: a repeated dedupe key changes nothing and returns applied=false.
create or replace function public.inventory_apply_movement(
  p_ws uuid, p_item uuid, p_loc uuid, p_kind text, p_delta numeric, p_reason text, p_ref_type text, p_ref_id text, p_ref_label text,
  p_by text, p_evidence text, p_dedupe text, p_unit_cost numeric default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_cost numeric; v_before numeric; v_total numeric; v_after numeric; v_new_cost numeric; v_id uuid;
begin
  select cost_vnd into v_cost from public.inventory_items where id = p_item and workspace_id = p_ws for update;
  if not found then raise exception 'inventory item not found'; end if;
  perform 1 from public.inventory_locations where id = p_loc and workspace_id = p_ws;
  if not found then raise exception 'inventory location not found'; end if;
  if p_dedupe is not null and exists (select 1 from public.inventory_movements where workspace_id = p_ws and dedupe_key = p_dedupe) then
    return jsonb_build_object('applied', false);
  end if;
  insert into public.inventory_stock_levels (workspace_id, item_id, location_id, qty) values (p_ws, p_item, p_loc, 0) on conflict do nothing;
  select qty into v_before from public.inventory_stock_levels where item_id = p_item and location_id = p_loc for update;
  select coalesce(sum(qty), 0) into v_total from public.inventory_stock_levels where item_id = p_item;
  v_after := v_before + p_delta;
  update public.inventory_stock_levels set qty = v_after, updated_at = now() where item_id = p_item and location_id = p_loc;
  if p_kind = 'in' and p_unit_cost is not null and p_delta > 0 then
    v_new_cost := case when v_total > 0 then round((v_total * v_cost + p_delta * p_unit_cost) / (v_total + p_delta), 2) else p_unit_cost end;
    update public.inventory_items set cost_vnd = v_new_cost, updated_at = now() where id = p_item;
  end if;
  insert into public.inventory_movements (workspace_id, item_id, location_id, kind, qty, qty_after, unit_cost_vnd, reason, ref_type, ref_id, ref_label, by_name, evidence, dedupe_key)
  values (p_ws, p_item, p_loc, p_kind, p_delta, v_after, p_unit_cost, coalesce(p_reason, ''), coalesce(p_ref_type, 'manual'), p_ref_id, p_ref_label, coalesce(p_by, 'NIVO'), p_evidence, p_dedupe)
  returning id into v_id;
  return jsonb_build_object('applied', true, 'movement_id', v_id, 'before', v_before, 'after', v_after, 'cost', coalesce(v_new_cost, v_cost));
end $$;
revoke all on function public.inventory_apply_movement(uuid, uuid, uuid, text, numeric, text, text, text, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.inventory_apply_movement(uuid, uuid, uuid, text, numeric, text, text, text, text, text, text, text, numeric) to service_role;

-- ---------------------------------------------------------------- work items about purchase orders and stock
-- subject_type was pinned to the original six subjects; a module adds its own ("purchase_order", "stock"), so drop that CHECK (found by definition).
do $$
declare r record;
begin
  for r in
    select c.conname from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
     where c.contype = 'c' and n.nspname = 'public' and t.relname = 'work_items' and pg_get_constraintdef(c.oid) like '%subject_type%'
  loop
    execute format('alter table public.work_items drop constraint %I', r.conname);
  end loop;
end $$;
