import { sql } from "@modules/platform/database"

/** Reads the stock locations of a workspace, the default first ($1 workspace). */
export const SELECT_WORKBENCH_LOCATIONS = sql`SELECT id, name, is_default
FROM public.inventory_locations
WHERE workspace_id = $1
ORDER BY is_default DESC, created_at
LIMIT 100`

/** Reads the suppliers of a workspace by name ($1 workspace). */
export const SELECT_WORKBENCH_SUPPLIERS = sql`SELECT id, name, contact_name, email, phone, zalo, channel, lead_time_days, payment_terms, note
FROM public.inventory_suppliers
WHERE workspace_id = $1
ORDER BY name
LIMIT 500`

/** Reads the catalogue items of a workspace by name ($1 workspace). */
export const SELECT_WORKBENCH_ITEMS = sql`SELECT id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases, active
FROM public.inventory_items
WHERE workspace_id = $1
ORDER BY name
LIMIT 2000`

/** Reads every stock level of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_LEVELS = sql`SELECT item_id, location_id, qty
FROM public.inventory_stock_levels
WHERE workspace_id = $1
LIMIT 10000`

/** Reads the active recipes of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_RECIPES = sql`SELECT id, name, aliases
FROM public.inventory_recipes
WHERE workspace_id = $1 AND active
ORDER BY name
LIMIT 500`

/** Reads every recipe line of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_RECIPE_LINES = sql`SELECT recipe_id, item_id, qty
FROM public.inventory_recipe_lines
WHERE workspace_id = $1
LIMIT 10000`

/** Reads the purchase orders of a workspace with the name and channel of their supplier, newest first ($1 workspace). */
export const SELECT_WORKBENCH_POS = sql`SELECT p.id, p.po_no, p.supplier_id, p.status, p.total_vnd, p.expected_at, p.message, p.sent_via, p.send_note, p.work_item_id, p.reminders, p.source, p.created_at, s.name AS supplier_name, s.channel AS supplier_channel
FROM public.inventory_purchase_orders p
LEFT JOIN public.inventory_suppliers s ON s.id = p.supplier_id
WHERE p.workspace_id = $1
ORDER BY p.created_at DESC
LIMIT 200`

/** Reads every purchase order line of a workspace ($1 workspace). */
export const SELECT_WORKBENCH_PO_LINES = sql`SELECT id, po_id, item_id, qty_ordered, qty_received, unit_cost_vnd
FROM public.inventory_po_lines
WHERE workspace_id = $1
LIMIT 3000`

/** Reads the recent stock movements of a workspace, newest first ($1 workspace). */
export const SELECT_WORKBENCH_MOVEMENTS = sql`SELECT id, item_id, kind, qty, qty_after, reason, ref_label, by_name, evidence, created_at
FROM public.inventory_movements
WHERE workspace_id = $1
ORDER BY created_at DESC
LIMIT 200`

/** Reads the inventory decisions waiting on the owner ($1 workspace). */
export const SELECT_WORKBENCH_WORK = sql`SELECT id, action, proposal, created_at
FROM public.work_items
WHERE workspace_id = $1 AND department = 'inventory' AND status = 'waiting_decision'
ORDER BY created_at
LIMIT 100`

/** Reads the items a movement took to zero or below since a day ($1 workspace, $2 since). */
export const SELECT_WORKBENCH_STOCK_OUTS = sql`SELECT item_id
FROM public.inventory_movements
WHERE workspace_id = $1 AND qty < 0 AND qty_after <= 0 AND created_at >= $2::timestamptz
LIMIT 5000`
