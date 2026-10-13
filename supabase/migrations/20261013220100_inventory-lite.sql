-- Inventory on the lite back end (be/src/modules/domain/inventory): every write the back end makes goes through a function here, so the back end SQL only reads tables and calls functions (schema authority).
-- The functions are security invoker: they run with the privileges of app_be and its policies, never with more. The table privileges and policies of app_be are in 20261012130100_app-be-grants.sql.

-- ---------------------------------------------------------------- write functions (security invoker: they run with the privileges of app_be)
create or replace function public.inventory_default_location(p_ws uuid, p_name text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  select id into v_id from public.inventory_locations where workspace_id = p_ws order by is_default desc, created_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.inventory_locations (workspace_id, name, is_default) values (p_ws, p_name, true) on conflict do nothing returning id into v_id;
  if v_id is not null then return v_id; end if;
  select id into v_id from public.inventory_locations where workspace_id = p_ws order by is_default desc, created_at limit 1;
  return v_id;
end
$fn$;
revoke all on function public.inventory_default_location(uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_default_location(uuid, text) to app_be;

create or replace function public.inventory_save_location(p_ws uuid, p_id uuid, p_name text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_locations (workspace_id, name) values (p_ws, p_name) returning id into v_id;
  else
    update public.inventory_locations set name = p_name where workspace_id = p_ws and id = p_id returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.inventory_save_location(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_save_location(uuid, uuid, text) to app_be;

create or replace function public.inventory_save_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_units jsonb, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid, p_aliases text[])
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_items (workspace_id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases)
    values (p_ws, p_sku, p_name, p_unit, p_units, p_category, p_cost, p_sell, p_reorder_point, p_reorder_qty, p_supplier, p_aliases)
    returning id into v_id;
  else
    update public.inventory_items set
      sku = coalesce(nullif(p_sku, ''), sku), name = p_name, unit = p_unit, units = p_units, category = p_category, cost_vnd = p_cost, sell_price_vnd = p_sell,
      reorder_point = p_reorder_point, reorder_qty = p_reorder_qty, supplier_id = p_supplier, aliases = p_aliases, updated_at = now()
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.inventory_save_item(uuid, uuid, text, text, text, jsonb, text, numeric, numeric, numeric, numeric, uuid, text[]) from public, anon, authenticated;
grant execute on function public.inventory_save_item(uuid, uuid, text, text, text, jsonb, text, numeric, numeric, numeric, numeric, uuid, text[]) to app_be;

create or replace function public.inventory_import_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_items (workspace_id, sku, name, unit, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id)
    values (p_ws, p_sku, p_name, p_unit, p_category, p_cost, p_sell, p_reorder_point, p_reorder_qty, p_supplier)
    returning id into v_id;
  else
    update public.inventory_items set
      name = p_name, unit = p_unit, category = p_category, cost_vnd = p_cost, sell_price_vnd = p_sell, reorder_point = p_reorder_point, reorder_qty = p_reorder_qty,
      supplier_id = coalesce(p_supplier, supplier_id), updated_at = now()
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.inventory_import_item(uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, uuid) from public, anon, authenticated;
grant execute on function public.inventory_import_item(uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, uuid) to app_be;

create or replace function public.inventory_set_item_active(p_ws uuid, p_id uuid, p_active boolean)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_items set active = p_active, updated_at = now() where workspace_id = p_ws and id = p_id;
end
$fn$;
revoke all on function public.inventory_set_item_active(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.inventory_set_item_active(uuid, uuid, boolean) to app_be;

create or replace function public.inventory_save_supplier(p_ws uuid, p_id uuid, p_name text, p_contact text, p_email text, p_phone text, p_zalo text, p_channel text, p_lead_time int, p_terms text, p_note text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_suppliers (workspace_id, name, contact_name, email, phone, zalo, channel, lead_time_days, payment_terms, note)
    values (p_ws, p_name, p_contact, p_email, p_phone, p_zalo, p_channel, p_lead_time, p_terms, p_note)
    returning id into v_id;
  else
    update public.inventory_suppliers set
      name = p_name, contact_name = p_contact, email = p_email, phone = p_phone, zalo = p_zalo, channel = p_channel, lead_time_days = p_lead_time,
      payment_terms = p_terms, note = p_note
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$fn$;
revoke all on function public.inventory_save_supplier(uuid, uuid, text, text, text, text, text, text, int, text, text) from public, anon, authenticated;
grant execute on function public.inventory_save_supplier(uuid, uuid, text, text, text, text, text, text, int, text, text) to app_be;

create or replace function public.inventory_save_recipe(p_ws uuid, p_id uuid, p_name text, p_aliases text[], p_item_ids uuid[], p_qtys numeric[])
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_recipes (workspace_id, name, aliases) values (p_ws, p_name, p_aliases) returning id into v_id;
  else
    update public.inventory_recipes set name = p_name, aliases = p_aliases where workspace_id = p_ws and id = p_id returning id into v_id;
    if v_id is null then return null; end if;
    delete from public.inventory_recipe_lines where workspace_id = p_ws and recipe_id = v_id;
  end if;
  insert into public.inventory_recipe_lines (workspace_id, recipe_id, item_id, qty)
  select p_ws, v_id, line.item_id, line.qty from unnest(p_item_ids, p_qtys) as line (item_id, qty);
  return v_id;
end
$fn$;
revoke all on function public.inventory_save_recipe(uuid, uuid, text, text[], uuid[], numeric[]) from public, anon, authenticated;
grant execute on function public.inventory_save_recipe(uuid, uuid, text, text[], uuid[], numeric[]) to app_be;

create or replace function public.inventory_delete_recipe(p_ws uuid, p_id uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.inventory_recipes where workspace_id = p_ws and id = p_id;
end
$fn$;
revoke all on function public.inventory_delete_recipe(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inventory_delete_recipe(uuid, uuid) to app_be;

create or replace function public.inventory_insert_po(p_ws uuid, p_po_no text, p_supplier uuid, p_expected date, p_note text, p_source text, p_by text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.inventory_purchase_orders (workspace_id, po_no, supplier_id, status, expected_at, note, source, created_by)
  values (p_ws, p_po_no, p_supplier, 'draft', p_expected, p_note, p_source, p_by)
  on conflict (workspace_id, po_no) do nothing
  returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.inventory_insert_po(uuid, text, uuid, date, text, text, text) from public, anon, authenticated;
grant execute on function public.inventory_insert_po(uuid, text, uuid, date, text, text, text) to app_be;

create or replace function public.inventory_add_po_lines(p_ws uuid, p_po uuid, p_item_ids uuid[], p_qtys numeric[], p_costs numeric[])
returns void language plpgsql set search_path = public as $fn$
begin
  insert into public.inventory_po_lines (workspace_id, po_id, item_id, qty_ordered, unit_cost_vnd)
  select p_ws, p_po, line.item_id, line.qty, line.unit_cost from unnest(p_item_ids, p_qtys, p_costs) as line (item_id, qty, unit_cost);
end
$fn$;
revoke all on function public.inventory_add_po_lines(uuid, uuid, uuid[], numeric[], numeric[]) from public, anon, authenticated;
grant execute on function public.inventory_add_po_lines(uuid, uuid, uuid[], numeric[], numeric[]) to app_be;

create or replace function public.inventory_recompute_po_total(p_po uuid)
returns numeric language plpgsql set search_path = public as $fn$
declare v_total numeric;
begin
  update public.inventory_purchase_orders set
    total_vnd = coalesce((select round(sum(qty_ordered * unit_cost_vnd)) from public.inventory_po_lines where po_id = p_po), 0), updated_at = now()
  where id = p_po
  returning total_vnd into v_total;
  return v_total;
end
$fn$;
revoke all on function public.inventory_recompute_po_total(uuid) from public, anon, authenticated;
grant execute on function public.inventory_recompute_po_total(uuid) to app_be;

create or replace function public.inventory_edit_po_draft(p_po uuid, p_supplier uuid, p_expected date, p_line_ids uuid[], p_qtys numeric[], p_costs numeric[])
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.inventory_po_lines where po_id = p_po and id in (select line.id from unnest(p_line_ids, p_qtys) as line (id, qty) where line.qty <= 0);
  update public.inventory_po_lines as target set qty_ordered = line.qty, unit_cost_vnd = line.unit_cost
  from unnest(p_line_ids, p_qtys, p_costs) as line (id, qty, unit_cost)
  where target.po_id = p_po and target.id = line.id and line.qty > 0;
  update public.inventory_purchase_orders set supplier_id = p_supplier, expected_at = p_expected where id = p_po;
  perform public.inventory_recompute_po_total(p_po);
end
$fn$;
revoke all on function public.inventory_edit_po_draft(uuid, uuid, date, uuid[], numeric[], numeric[]) from public, anon, authenticated;
grant execute on function public.inventory_edit_po_draft(uuid, uuid, date, uuid[], numeric[], numeric[]) to app_be;

create or replace function public.inventory_set_po_message(p_po uuid, p_message text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set message = p_message, updated_at = now() where id = p_po;
end
$fn$;
revoke all on function public.inventory_set_po_message(uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_set_po_message(uuid, text) to app_be;

create or replace function public.inventory_mark_po_waiting(p_po uuid, p_work_item uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set status = 'waiting_approval', work_item_id = p_work_item, updated_at = now() where id = p_po and status = 'draft';
end
$fn$;
revoke all on function public.inventory_mark_po_waiting(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inventory_mark_po_waiting(uuid, uuid) to app_be;

create or replace function public.inventory_mark_po_sent(p_po uuid, p_via text, p_message text, p_work_item uuid, p_note text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set
    status = 'sent', sent_at = now(), sent_via = p_via, message = p_message, work_item_id = p_work_item, send_note = p_note, updated_at = now()
  where id = p_po;
end
$fn$;
revoke all on function public.inventory_mark_po_sent(uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_mark_po_sent(uuid, text, text, uuid, text) to app_be;

create or replace function public.inventory_mark_po_reminded(p_po uuid, p_note text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set reminders = reminders + 1, send_note = p_note, updated_at = now() where id = p_po;
end
$fn$;
revoke all on function public.inventory_mark_po_reminded(uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_mark_po_reminded(uuid, text) to app_be;

create or replace function public.inventory_refuse_po(p_ws uuid, p_po uuid, p_note text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set status = 'draft', work_item_id = null, send_note = p_note, updated_at = now()
  where workspace_id = p_ws and id = p_po and status = 'waiting_approval';
end
$fn$;
revoke all on function public.inventory_refuse_po(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_refuse_po(uuid, uuid, text) to app_be;

create or replace function public.inventory_cancel_po(p_ws uuid, p_po uuid)
returns table (po_no text, work_item_id uuid) language sql set search_path = public as $fn$
update public.inventory_purchase_orders as target set status = 'cancelled', updated_at = now()
where target.workspace_id = p_ws and target.id = p_po and target.status in ('draft', 'waiting_approval', 'sent')
returning target.po_no, target.work_item_id;
$fn$;
revoke all on function public.inventory_cancel_po(uuid, uuid) from public, anon, authenticated;
grant execute on function public.inventory_cancel_po(uuid, uuid) to app_be;

create or replace function public.inventory_open_receipt(p_ws uuid, p_po uuid, p_invoice text, p_note text, p_by text)
returns uuid language plpgsql set search_path = public as $fn$
declare v_id uuid;
begin
  insert into public.inventory_receipts (workspace_id, po_id, invoice_no, note, received_by) values (p_ws, p_po, p_invoice, p_note, p_by) returning id into v_id;
  return v_id;
end
$fn$;
revoke all on function public.inventory_open_receipt(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.inventory_open_receipt(uuid, uuid, text, text, text) to app_be;

create or replace function public.inventory_discard_receipt(p_receipt uuid)
returns void language plpgsql set search_path = public as $fn$
begin
  delete from public.inventory_receipts where id = p_receipt;
end
$fn$;
revoke all on function public.inventory_discard_receipt(uuid) from public, anon, authenticated;
grant execute on function public.inventory_discard_receipt(uuid) to app_be;

create or replace function public.inventory_close_receipt(p_receipt uuid, p_total numeric)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_receipts set total_vnd = p_total where id = p_receipt;
end
$fn$;
revoke all on function public.inventory_close_receipt(uuid, numeric) from public, anon, authenticated;
grant execute on function public.inventory_close_receipt(uuid, numeric) to app_be;

create or replace function public.inventory_receive_po_line(p_line uuid, p_qty numeric, p_cost numeric)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_po_lines set qty_received = qty_received + p_qty, unit_cost_vnd = p_cost where id = p_line;
end
$fn$;
revoke all on function public.inventory_receive_po_line(uuid, numeric, numeric) from public, anon, authenticated;
grant execute on function public.inventory_receive_po_line(uuid, numeric, numeric) to app_be;

create or replace function public.inventory_set_po_status(p_po uuid, p_status text)
returns void language plpgsql set search_path = public as $fn$
begin
  update public.inventory_purchase_orders set status = p_status, updated_at = now() where id = p_po;
end
$fn$;
revoke all on function public.inventory_set_po_status(uuid, text) from public, anon, authenticated;
grant execute on function public.inventory_set_po_status(uuid, text) to app_be;

-- The existing definer function that changes a quantity is the one door the back end uses for stock movements.
grant execute on function public.inventory_apply_movement(uuid, uuid, uuid, text, numeric, text, text, text, text, text, text, text, numeric) to app_be;
