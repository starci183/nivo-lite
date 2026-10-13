/** The location columns the workbench reads. */
export interface WorkbenchLocationRow {
    /** The location id. */
    readonly id: string
    /** The location name. */
    readonly name: string
    /** Whether it is the default location. */
    readonly is_default: boolean
}

/** The supplier columns the workbench reads. */
export interface WorkbenchSupplierRow {
    /** The supplier id. */
    readonly id: string
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contact_name: string
    /** The order email address. */
    readonly email: string | null
    /** The phone number. */
    readonly phone: string | null
    /** The Zalo contact. */
    readonly zalo: string | null
    /** How orders reach the supplier. */
    readonly channel: string
    /** The delivery time in days. */
    readonly lead_time_days: number
    /** The payment terms. */
    readonly payment_terms: string
    /** A free note. */
    readonly note: string
}

/** One other unit of an item as stored in its units column. */
export interface WorkbenchUnitRow {
    /** The unit name. */
    readonly unit?: string
    /** How many base units one of this unit holds. */
    readonly factor?: number
}

/** The item columns the workbench reads. */
export interface WorkbenchItemRow {
    /** The item id. */
    readonly id: string
    /** The item code. */
    readonly sku: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** Other units. */
    readonly units: Array<WorkbenchUnitRow> | null
    /** The item group. */
    readonly category: string
    /** The cost per base unit; numeric arrives as text. */
    readonly cost_vnd: number | string
    /** The selling price per base unit. */
    readonly sell_price_vnd: number | string | null
    /** The low-stock level. */
    readonly reorder_point: number | string
    /** The usual order quantity. */
    readonly reorder_qty: number | string
    /** The usual supplier. */
    readonly supplier_id: string | null
    /** Other names. */
    readonly aliases: Array<string>
    /** Whether the item is in use. */
    readonly active: boolean
}

/** The stock level columns the workbench reads. */
export interface WorkbenchLevelRow {
    /** The item. */
    readonly item_id: string
    /** The location. */
    readonly location_id: string
    /** The quantity on hand; numeric arrives as text. */
    readonly qty: number | string
}

/** The recipe columns the workbench reads. */
export interface WorkbenchRecipeRow {
    /** The recipe id. */
    readonly id: string
    /** The product name. */
    readonly name: string
    /** Other names. */
    readonly aliases: Array<string>
}

/** The recipe line columns the workbench reads. */
export interface WorkbenchRecipeLineRow {
    /** The recipe. */
    readonly recipe_id: string
    /** The ingredient item. */
    readonly item_id: string
    /** The quantity per product. */
    readonly qty: number | string
}

/** The purchase order columns the workbench reads, with the supplier name and channel joined. */
export interface WorkbenchPoRow {
    /** The purchase order id. */
    readonly id: string
    /** The order number. */
    readonly po_no: string
    /** The supplier. */
    readonly supplier_id: string | null
    /** The supplier name. */
    readonly supplier_name: string | null
    /** The supplier channel. */
    readonly supplier_channel: string | null
    /** The status. */
    readonly status: string
    /** The order value; numeric arrives as text. */
    readonly total_vnd: number | string
    /** The expected date. */
    readonly expected_at: Date | string | null
    /** The order message. */
    readonly message: string
    /** How the order went out. */
    readonly sent_via: string | null
    /** Why it was not sent. */
    readonly send_note: string | null
    /** The send decision. */
    readonly work_item_id: string | null
    /** How many reminders went out. */
    readonly reminders: number
    /** Who raised it. */
    readonly source: string
    /** When it was raised. */
    readonly created_at: Date | string
}

/** The purchase order line columns the workbench reads. */
export interface WorkbenchPoLineRow {
    /** The line id. */
    readonly id: string
    /** The purchase order. */
    readonly po_id: string
    /** The item. */
    readonly item_id: string
    /** The ordered quantity. */
    readonly qty_ordered: number | string
    /** The received quantity. */
    readonly qty_received: number | string
    /** The unit cost. */
    readonly unit_cost_vnd: number | string
}

/** The movement columns the history reads. */
export interface WorkbenchMovementRow {
    /** The movement id. */
    readonly id: string
    /** The item. */
    readonly item_id: string
    /** The kind. */
    readonly kind: string
    /** The signed change. */
    readonly qty: number | string
    /** The level after. */
    readonly qty_after: number | string
    /** Why it moved. */
    readonly reason: string
    /** The reference label. */
    readonly ref_label: string | null
    /** Who moved it. */
    readonly by_name: string
    /** The evidence link. */
    readonly evidence: string | null
    /** When it moved. */
    readonly created_at: Date | string
}

/** The work item columns the waiting list reads. */
export interface WorkbenchWorkRow {
    /** The decision id. */
    readonly id: string
    /** The action it decides. */
    readonly action: string
    /** The proposal. */
    readonly proposal: Record<string, unknown>
    /** When it was asked. */
    readonly created_at: Date | string
}

/** An item that stocked out in the watched window. */
export interface WorkbenchStockOutRow {
    /** The item. */
    readonly item_id: string
}
