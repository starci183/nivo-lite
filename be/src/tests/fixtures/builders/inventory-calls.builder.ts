/** The statements `callDbFunction` sends for each inventory database function, as the entity manager double sees them. */

export const DEFAULT_LOCATION = "SELECT * FROM public.inventory_default_location($1, $2)"

export const SAVE_LOCATION = "SELECT * FROM public.inventory_save_location($1, $2, $3)"

export const APPLY_MOVEMENT =
    "SELECT * FROM public.inventory_apply_movement($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"

export const SAVE_ITEM =
    "SELECT * FROM public.inventory_save_item($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)"

export const IMPORT_ITEM = "SELECT * FROM public.inventory_import_item($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

export const SET_ITEM_ACTIVE = "SELECT * FROM public.inventory_set_item_active($1, $2, $3)"

export const SAVE_SUPPLIER =
    "SELECT * FROM public.inventory_save_supplier($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"

export const SAVE_RECIPE = "SELECT * FROM public.inventory_save_recipe($1, $2, $3, $4, $5, $6)"

export const DELETE_RECIPE = "SELECT * FROM public.inventory_delete_recipe($1, $2)"

export const INSERT_PO = "SELECT * FROM public.inventory_insert_po($1, $2, $3, $4, $5, $6, $7)"

export const ADD_PO_LINES = "SELECT * FROM public.inventory_add_po_lines($1, $2, $3, $4, $5)"

export const RECOMPUTE_PO_TOTAL = "SELECT * FROM public.inventory_recompute_po_total($1)"

export const EDIT_PO_DRAFT = "SELECT * FROM public.inventory_edit_po_draft($1, $2, $3, $4, $5, $6)"

export const SET_PO_MESSAGE = "SELECT * FROM public.inventory_set_po_message($1, $2)"

export const MARK_PO_WAITING = "SELECT * FROM public.inventory_mark_po_waiting($1, $2)"

export const MARK_PO_SENT = "SELECT * FROM public.inventory_mark_po_sent($1, $2, $3, $4, $5)"

export const MARK_PO_REMINDED = "SELECT * FROM public.inventory_mark_po_reminded($1, $2)"

export const REFUSE_PO = "SELECT * FROM public.inventory_refuse_po($1, $2, $3)"

export const CANCEL_PO = "SELECT * FROM public.inventory_cancel_po($1, $2)"

export const OPEN_RECEIPT = "SELECT * FROM public.inventory_open_receipt($1, $2, $3, $4, $5)"

export const DISCARD_RECEIPT = "SELECT * FROM public.inventory_discard_receipt($1)"

export const CLOSE_RECEIPT = "SELECT * FROM public.inventory_close_receipt($1, $2)"

export const RECEIVE_PO_LINE = "SELECT * FROM public.inventory_receive_po_line($1, $2, $3)"

export const SET_PO_STATUS = "SELECT * FROM public.inventory_set_po_status($1, $2)"
