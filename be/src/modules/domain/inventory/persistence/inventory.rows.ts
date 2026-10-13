/** The columns of public.inventory_recipes the domain reads. */
export interface InventoryRecipesRow {
    /** The recipe id. */
    readonly id: string
    /** The product name. */
    readonly name: string
    /** Other names of the product. */
    readonly aliases: Array<string>
}

/** The columns of public.inventory_recipe_lines the domain reads; numeric columns arrive as decimal text. */
export interface InventoryRecipeLinesRow {
    /** The recipe the ingredient belongs to. */
    readonly recipe_id: string
    /** The ingredient item. */
    readonly item_id: string
    /** The quantity per product. */
    readonly qty: number | string
}

/** The columns of public.inventory_purchase_orders the domain reads; numeric columns arrive as decimal text. */
export interface InventoryPurchaseOrdersRow {
    /** The order id. */
    readonly id: string
    /** The order number. */
    readonly po_no: string
    /** The supplier. */
    readonly supplier_id: string | null
    /** The order status. */
    readonly status: string
    /** The order total. */
    readonly total_vnd: number | string
    /** The expected delivery day as YYYY-MM-DD. */
    readonly expected_at: string | null
    /** The message to the supplier. */
    readonly message: string
    /** How many reminders were sent. */
    readonly reminders: number
}

/** The columns of public.inventory_po_lines the domain reads; numeric columns arrive as decimal text. */
export interface InventoryPoLinesRow {
    /** The line id. */
    readonly id: string
    /** The ordered item. */
    readonly item_id: string
    /** The ordered quantity. */
    readonly qty_ordered: number | string
    /** The quantity received so far. */
    readonly qty_received: number | string
    /** The unit cost. */
    readonly unit_cost_vnd: number | string
}

/** The columns of public.inventory_commands the job reads. */
export interface InventoryCommandsRow {
    /** The command id. */
    readonly id: string
    /** The workspace the command acts in. */
    readonly workspace_id: string
    /** What the command asks for, one of the operation names. */
    readonly kind: string
    /** The typed input of the command as submitted. */
    readonly input: unknown
    /** queued, done or failed. */
    readonly status: string
    /** The member who submitted the command: the service runs as this person. */
    readonly created_by: string
}
