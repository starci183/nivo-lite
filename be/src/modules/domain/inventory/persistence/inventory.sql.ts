import { sql } from "@modules/platform/database"

/** Reads or creates the default stock location of a workspace and answers its id ($1 workspace, $2 name for a new one). */
export const DEFAULT_LOCATION = sql`SELECT public.inventory_default_location($1::uuid, $2::text) AS id`

/** Renames a location, or adds one when no id is given ($1 workspace, $2 location or null, $3 name). */
export const SAVE_LOCATION = sql`SELECT public.inventory_save_location($1::uuid, $2::uuid, $3::text) AS id`

/** Reads the names of the named locations ($1 workspace, $2 location ids). */
export const SELECT_LOCATION_NAMES = sql`SELECT id, name FROM public.inventory_locations
WHERE workspace_id = $1 AND id = ANY($2::uuid[])
LIMIT 10`

/** Applies one signed stock movement through the one function that changes a quantity ($1 workspace, $2 item, $3 location, $4 kind, $5 delta, $6 reason, $7 ref type, $8 ref id, $9 ref label, $10 by, $11 evidence, $12 dedupe key, $13 unit cost). */
export const APPLY_MOVEMENT = sql`SELECT public.inventory_apply_movement($1::uuid, $2::uuid, $3::uuid, $4, $5::numeric, $6, $7, $8, $9, $10, $11, $12, $13::numeric) AS result`

/** Reads the quantity of one item at one location ($1 item, $2 location). */
export const SELECT_LEVEL_QTY = sql`SELECT qty FROM public.inventory_stock_levels WHERE item_id = $1 AND location_id = $2 LIMIT 1`

/** Reads the total stock of the named items across all locations ($1 workspace, $2 item ids). */
export const SELECT_TOTALS = sql`SELECT item_id, SUM(qty) AS qty FROM public.inventory_stock_levels
WHERE workspace_id = $1 AND item_id = ANY($2::uuid[])
GROUP BY item_id
LIMIT 5000`

/** Reads the total stock of every item of a workspace ($1 workspace). */
export const SELECT_ALL_TOTALS = sql`SELECT item_id, SUM(qty) AS qty FROM public.inventory_stock_levels
WHERE workspace_id = $1
GROUP BY item_id
LIMIT 5000`

/** Reads one item ($1 workspace, $2 item). */
export const SELECT_ITEM = sql`SELECT id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases, active
FROM public.inventory_items
WHERE workspace_id = $1 AND id = $2
LIMIT 1`

/** Reads the name and unit of one item ($1 workspace, $2 item). */
export const SELECT_ITEM_LABEL = sql`SELECT name, unit FROM public.inventory_items WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Reads the active items of a workspace (matching an order, finding the low ones, reporting stock value) ($1 workspace). */
export const SELECT_ACTIVE_ITEMS = sql`SELECT id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases, active
FROM public.inventory_items
WHERE workspace_id = $1 AND active
ORDER BY name
LIMIT 2000`

/** Reads the named active items of a workspace ($1 workspace, $2 item ids). */
export const SELECT_ACTIVE_ITEMS_BY_ID = sql`SELECT id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases, active
FROM public.inventory_items
WHERE workspace_id = $1 AND active AND id = ANY($2::uuid[])
ORDER BY name
LIMIT 2000`

/** Reads the identity of every item of a workspace, to match imported rows ($1 workspace). */
export const SELECT_ITEM_REFS = sql`SELECT id, sku, name FROM public.inventory_items WHERE workspace_id = $1 LIMIT 5000`

/** Creates or updates one item and answers its id, null when the item to update is missing; an empty sku keeps the current one ($1 workspace, $2 item or null, $3 sku, $4 name, $5 unit, $6 units json, $7 category, $8 cost, $9 sell price, $10 reorder point, $11 reorder qty, $12 supplier, $13 aliases). */
export const SAVE_ITEM = sql`SELECT public.inventory_save_item($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::jsonb, $7::text, $8::numeric, $9::numeric, $10::numeric, $11::numeric, $12::uuid, $13::text[]) AS id`

/** Creates or updates an item from an import row and answers its id; the supplier stays when the row names none ($1 workspace, $2 item or null, $3 sku, $4 name, $5 unit, $6 category, $7 cost, $8 sell price, $9 reorder point, $10 reorder qty, $11 supplier or null). */
export const IMPORT_ITEM = sql`SELECT public.inventory_import_item($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::uuid) AS id`

/** Switches one item on or off ($1 workspace, $2 item, $3 active). */
export const SET_ITEM_ACTIVE = sql`SELECT public.inventory_set_item_active($1::uuid, $2::uuid, $3::boolean)`

/** Reads the suppliers of a workspace by name, to match imported and starter rows ($1 workspace). */
export const SELECT_SUPPLIER_NAMES = sql`SELECT id, name FROM public.inventory_suppliers WHERE workspace_id = $1 LIMIT 1000`

/** Reads the delivery time of one supplier ($1 workspace, $2 supplier). */
export const SELECT_SUPPLIER_LEAD_TIME = sql`SELECT lead_time_days FROM public.inventory_suppliers WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Creates or updates one supplier and answers its id, null when the supplier to update is missing ($1 workspace, $2 supplier or null, $3 name, $4 contact, $5 email, $6 phone, $7 zalo, $8 channel, $9 lead time days, $10 payment terms, $11 note). */
export const SAVE_SUPPLIER = sql`SELECT public.inventory_save_supplier($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, $9::int, $10::text, $11::text) AS id`

/** Reads the active recipes of a workspace ($1 workspace). */
export const SELECT_ACTIVE_RECIPES = sql`SELECT id, name, aliases FROM public.inventory_recipes WHERE workspace_id = $1 AND active LIMIT 1000`

/** Reads the ingredient lines of every recipe of a workspace ($1 workspace). */
export const SELECT_RECIPE_LINES = sql`SELECT recipe_id, item_id, qty FROM public.inventory_recipe_lines WHERE workspace_id = $1 LIMIT 10000`

/** Reads the names of the recipes of a workspace ($1 workspace). */
export const SELECT_RECIPE_NAMES = sql`SELECT name FROM public.inventory_recipes WHERE workspace_id = $1 LIMIT 1000`

/** Creates a recipe, or replaces the one named, with its ingredient lines in one step and answers its id, null when the recipe to replace is missing ($1 workspace, $2 recipe or null, $3 name, $4 aliases, $5 ingredient item ids, $6 quantities). */
export const SAVE_RECIPE = sql`SELECT public.inventory_save_recipe($1::uuid, $2::uuid, $3::text, $4::text[], $5::uuid[], $6::numeric[]) AS id`

/** Deletes one recipe; its lines go with it ($1 workspace, $2 recipe). */
export const DELETE_RECIPE = sql`SELECT public.inventory_delete_recipe($1::uuid, $2::uuid)`

/** Reads the last purchase order number of a month ($1 workspace, $2 number prefix pattern). */
export const SELECT_LAST_PO_NO = sql`SELECT po_no FROM public.inventory_purchase_orders
WHERE workspace_id = $1 AND po_no LIKE $2
ORDER BY po_no DESC
LIMIT 1`

/** Creates one draft purchase order and answers its id; a clashing number answers null so the caller retries ($1 workspace, $2 number, $3 supplier, $4 expected day, $5 note, $6 source, $7 created by). */
export const INSERT_PO = sql`SELECT public.inventory_insert_po($1::uuid, $2::text, $3::uuid, $4::date, $5::text, $6::text, $7::text) AS id`

/** Writes lines for one purchase order ($1 workspace, $2 order, $3 item ids, $4 quantities, $5 unit costs). */
export const ADD_PO_LINES = sql`SELECT public.inventory_add_po_lines($1::uuid, $2::uuid, $3::uuid[], $4::numeric[], $5::numeric[])`

/** Sets the total of one purchase order from its lines and answers it ($1 order). */
export const RECOMPUTE_PO_TOTAL = sql`SELECT public.inventory_recompute_po_total($1::uuid) AS total`

/** Edits a draft order in one step: supplier, expected day, line quantities and costs (a quantity of zero removes the line), then its total ($1 order, $2 supplier or null, $3 expected day or null, $4 line ids, $5 quantities, $6 unit costs). */
export const EDIT_PO_DRAFT = sql`SELECT public.inventory_edit_po_draft($1::uuid, $2::uuid, $3::date, $4::uuid[], $5::numeric[], $6::numeric[])`

/** Reads the status of one purchase order ($1 workspace, $2 order). */
export const SELECT_PO_STATUS = sql`SELECT id, status FROM public.inventory_purchase_orders WHERE workspace_id = $1 AND id = $2 LIMIT 1`

/** Reads the open orders and the quantity still to arrive per item ($1 workspace). */
export const SELECT_ON_ORDER = sql`SELECT line.item_id, SUM(GREATEST(line.qty_ordered - line.qty_received, 0)) AS qty
FROM public.inventory_po_lines line
JOIN public.inventory_purchase_orders po ON po.id = line.po_id
WHERE po.workspace_id = $1 AND po.status IN ('draft', 'waiting_approval', 'sent', 'partially_received')
GROUP BY line.item_id
LIMIT 5000`

/** Reads the oldest draft order of a supplier, or of no supplier ($1 workspace, $2 supplier or null). */
export const SELECT_DRAFT_PO = sql`SELECT id FROM public.inventory_purchase_orders
WHERE workspace_id = $1 AND status = 'draft' AND supplier_id IS NOT DISTINCT FROM $2::uuid
ORDER BY created_at
LIMIT 1`

/** Reads the items already on one order ($1 order). */
export const SELECT_PO_ITEM_IDS = sql`SELECT item_id FROM public.inventory_po_lines WHERE po_id = $1 LIMIT 1000`

/** Reads the number and total of one order ($1 order). */
export const SELECT_PO_SUMMARY = sql`SELECT po_no, total_vnd FROM public.inventory_purchase_orders WHERE id = $1 LIMIT 1`

/** Reads which of the named orders have a supplier ($1 order ids). */
export const SELECT_POS_WITH_SUPPLIER = sql`SELECT id FROM public.inventory_purchase_orders WHERE id = ANY($1::uuid[]) AND supplier_id IS NOT NULL LIMIT 200`

/** Reads one purchase order with its supplier ($1 workspace, $2 order). */
export const SELECT_PO = sql`SELECT po.id, po.po_no, po.supplier_id, po.status, po.total_vnd, to_char(po.expected_at, 'YYYY-MM-DD') AS expected_at, po.message, po.reminders,
    supplier.name AS supplier_name, supplier.contact_name AS supplier_contact, supplier.email AS supplier_email,
    supplier.channel AS supplier_channel, supplier.lead_time_days AS supplier_lead_time
FROM public.inventory_purchase_orders po
LEFT JOIN public.inventory_suppliers supplier ON supplier.id = po.supplier_id
WHERE po.workspace_id = $1 AND po.id = $2
LIMIT 1`

/** Reads the lines of one purchase order with their items ($1 order). */
export const SELECT_PO_LINES = sql`SELECT line.id, line.item_id, line.qty_ordered, line.qty_received, line.unit_cost_vnd, item.name AS item_name, item.unit AS item_unit
FROM public.inventory_po_lines line
LEFT JOIN public.inventory_items item ON item.id = line.item_id
WHERE line.po_id = $1
ORDER BY line.id
LIMIT 1000`

/** Counts the send decisions already opened for an order, to number the next attempt ($1 workspace, $2 dedupe key pattern). */
export const COUNT_SEND_ATTEMPTS = sql`SELECT COUNT(*)::int AS attempts FROM public.work_items WHERE workspace_id = $1 AND dedupe_key LIKE $2`

/** Stores the order message on a draft order ($1 order, $2 message). */
export const SET_PO_MESSAGE = sql`SELECT public.inventory_set_po_message($1::uuid, $2::text)`

/** Moves a draft order to waiting for approval, remembering its decision ($1 order, $2 work item). */
export const MARK_PO_WAITING = sql`SELECT public.inventory_mark_po_waiting($1::uuid, $2::uuid)`

/** Marks an order sent ($1 order, $2 via, $3 message, $4 work item, $5 note). */
export const MARK_PO_SENT = sql`SELECT public.inventory_mark_po_sent($1::uuid, $2::text, $3::text, $4::uuid, $5::text)`

/** Counts one more reminder on an order ($1 order, $2 note or null). */
export const MARK_PO_REMINDED = sql`SELECT public.inventory_mark_po_reminded($1::uuid, $2::text)`

/** Puts a refused order back to a draft ($1 workspace, $2 order, $3 note). */
export const REFUSE_PO = sql`SELECT public.inventory_refuse_po($1::uuid, $2::uuid, $3::text)`

/** Cancels an order that has not been received and answers its number and decision; no row when it can no longer be cancelled ($1 workspace, $2 order). */
export const CANCEL_PO = sql`SELECT po_no, work_item_id FROM public.inventory_cancel_po($1::uuid, $2::uuid) LIMIT 1`

/** Opens a receipt of goods and answers its id ($1 workspace, $2 order, $3 invoice number, $4 note, $5 received by). */
export const OPEN_RECEIPT = sql`SELECT public.inventory_open_receipt($1::uuid, $2::uuid, $3::text, $4::text, $5::text) AS id`

/** Removes a receipt that received nothing ($1 receipt). */
export const DISCARD_RECEIPT = sql`SELECT public.inventory_discard_receipt($1::uuid)`

/** Sets the value of a receipt ($1 receipt, $2 total). */
export const CLOSE_RECEIPT = sql`SELECT public.inventory_close_receipt($1::uuid, $2::numeric)`

/** Adds the received quantity and the real cost to an order line ($1 line, $2 received quantity, $3 unit cost). */
export const RECEIVE_PO_LINE = sql`SELECT public.inventory_receive_po_line($1::uuid, $2::numeric, $3::numeric)`

/** Sets the status of an order after a receipt ($1 order, $2 status). */
export const SET_PO_STATUS = sql`SELECT public.inventory_set_po_status($1::uuid, $2::text)`

/** Reads the owner's rule mode for one gated action ($1 workspace, $2 action). */
export const SELECT_RULE_MODE = sql`SELECT mode FROM public.authority_rules WHERE workspace_id = $1 AND action = $2 LIMIT 1`

/** Reads whether the accounting module is installed ($1 workspace). */
export const SELECT_ACCOUNTING_INSTALLED = sql`SELECT id FROM public.module_installations WHERE workspace_id = $1 AND module_key = 'accounting' LIMIT 1`

/** Reads the brand voice the owner wrote ($1 workspace). */
export const SELECT_BRAND_VOICE = sql`SELECT brand_voice, reply_style FROM public.authority WHERE workspace_id = $1 LIMIT 1`

/** Reads the stock movements since a moment, for the weekly report ($1 workspace, $2 since). */
export const SELECT_MOVEMENTS_SINCE = sql`SELECT kind, qty, unit_cost_vnd, item_id FROM public.inventory_movements
WHERE workspace_id = $1 AND created_at >= $2
LIMIT 20000`

/** Reads the open orders with their suppliers, for the weekly report ($1 workspace). */
export const SELECT_OPEN_POS = sql`SELECT po.po_no, po.status, po.total_vnd, supplier.name AS supplier_name
FROM public.inventory_purchase_orders po
LEFT JOIN public.inventory_suppliers supplier ON supplier.id = po.supplier_id
WHERE po.workspace_id = $1 AND po.status IN ('draft', 'waiting_approval', 'sent', 'partially_received')
ORDER BY po.created_at
LIMIT 500`

/** Reads one sent order for an overdue reminder ($1 workspace, $2 order). */
export const SELECT_PO_FOR_REMINDER = sql`SELECT po.id, po.po_no, po.status, po.reminders, to_char(po.expected_at, 'YYYY-MM-DD') AS expected_at, supplier.name AS supplier_name
FROM public.inventory_purchase_orders po
LEFT JOIN public.inventory_suppliers supplier ON supplier.id = po.supplier_id
WHERE po.workspace_id = $1 AND po.id = $2
LIMIT 1`

/** Reads the sent orders past their due date that still deserve a reminder: fewer than two so far, the last one at least two days ago ($1 workspace, $2 cutoff day, $3 last reminder cutoff). */
export const SELECT_OVERDUE_POS = sql`SELECT id, reminders FROM public.inventory_purchase_orders
WHERE workspace_id = $1 AND status IN ('sent', 'partially_received') AND expected_at IS NOT NULL AND expected_at < $2::date AND reminders < 2
    AND (reminders = 0 OR updated_at < $3::timestamptz)
LIMIT 20`

/** Reads one submitted command with its input, status and the member who submitted it ($1 command, $2 workspace). */
export const SELECT_COMMAND = sql`SELECT id, workspace_id, kind, input, status, created_by FROM public.inventory_commands WHERE id = $1::uuid AND workspace_id = $2::uuid LIMIT 1`

/** Settles a queued command once with its status, result and refusal ($1 command, $2 status, $3 result json or null, $4 error code or null, $5 error sentence or null). */
export const FINISH_COMMAND = sql`SELECT public.inventory_command_finish($1::uuid, $2::text, $3::jsonb, $4::text, $5::text)`
