/** How an item stands against its reorder point. */
export type StockStatus = "out" | "low" | "ok" | "over"

/** Where a purchase order is in its life. */
export type PoStatus = "draft" | "waiting_approval" | "sent" | "partially_received" | "received" | "cancelled"

/** How an order reaches a supplier. */
export type SupplierChannel = "email" | "zalo" | "phone"

/** One alternative unit of an item. */
export interface ItemUnit {
    /** The unit name. */
    readonly unit: string
    /** How many base units one of this unit holds. */
    readonly factor: number
}

/** One stock location. */
export interface LocationView {
    readonly id: string
    readonly name: string
}

/** One supplier row. */
export interface SupplierView {
    readonly id: string
    readonly name: string
    readonly contactName: string
    readonly email: string | null
    readonly phone: string | null
    readonly zalo: string | null
    readonly channel: SupplierChannel
    readonly leadTimeDays: number
    readonly paymentTerms: string
    readonly note: string
}

/** The quantity of one item at one location. */
export interface ItemLevel {
    readonly locationId: string
    readonly qty: number
}

/** One catalogue item with its stock. */
export interface ItemView {
    readonly id: string
    readonly sku: string
    readonly name: string
    readonly unit: string
    readonly units: ReadonlyArray<ItemUnit>
    readonly category: string
    readonly costVnd: number
    readonly sellPriceVnd: number | null
    readonly reorderPoint: number
    readonly reorderQty: number
    readonly supplierId: string | null
    readonly aliases: ReadonlyArray<string>
    readonly active: boolean
    /** The quantity over all locations. */
    readonly total: number
    readonly status: StockStatus
    /** The quantity on open purchase orders not yet received. */
    readonly onOrder: number
    readonly levels: ReadonlyArray<ItemLevel>
}

/** One line of a purchase order. */
export interface PoLineView {
    readonly id: string
    readonly itemId: string
    /** The item name, or an empty text when the item is gone. */
    readonly name: string
    readonly unit: string
    readonly qtyOrdered: number
    readonly qtyReceived: number
    readonly unitCost: number
}

/** One purchase order with its lines. */
export interface PoView {
    readonly id: string
    readonly poNo: string
    readonly supplierId: string | null
    /** The supplier name, or an empty text when none is chosen. */
    readonly supplierName: string
    readonly channel: SupplierChannel | null
    readonly status: PoStatus
    readonly totalVnd: number
    readonly expectedAt: string | null
    readonly message: string
    readonly sentVia: "email" | "copy" | null
    readonly sendNote: string | null
    readonly workItemId: string | null
    readonly reminders: number
    readonly source: "auto" | "manual"
    readonly createdAt: string
    readonly lines: ReadonlyArray<PoLineView>
}

/** One stock movement of the history. */
export interface MovementView {
    readonly id: string
    readonly itemName: string
    readonly unit: string
    readonly kind: string
    readonly qty: number
    readonly qtyAfter: number
    readonly reason: string
    readonly refLabel: string | null
    readonly byName: string
    readonly evidence: string | null
    readonly createdAt: string
}

/** One ingredient of a recipe. */
export interface RecipeLineView {
    readonly itemId: string
    readonly name: string
    readonly unit: string
    readonly qty: number
}

/** One recipe. */
export interface RecipeView {
    readonly id: string
    readonly name: string
    readonly aliases: ReadonlyArray<string>
    readonly lines: ReadonlyArray<RecipeLineView>
}

/** One decision that waits for the owner. */
export interface PendingView {
    readonly id: string
    readonly action: "send_purchase_order" | "adjust_stock"
    readonly summary: string
    readonly draft: string | null
    readonly poId: string | null
    readonly createdAt: string
}

/** The numbers over the active items. */
export interface InventoryMetrics {
    readonly valueVnd: number
    readonly itemCount: number
    readonly lowCount: number
    readonly outCount: number
    readonly openPos: number
    readonly pendingCount: number
}

/** The starter set a business kind can load. */
export interface InventoryTemplateChoice {
    readonly key: string
    readonly name: string
    readonly description: string
}

/** Everything the inventory workbench shows. */
export interface InventoryWorkbenchData {
    readonly canManage: boolean
    readonly defaultLocationId: string | null
    readonly locations: ReadonlyArray<LocationView>
    readonly suppliers: ReadonlyArray<SupplierView>
    readonly items: ReadonlyArray<ItemView>
    readonly recipes: ReadonlyArray<RecipeView>
    readonly pos: ReadonlyArray<PoView>
    readonly movements: ReadonlyArray<MovementView>
    readonly pending: ReadonlyArray<PendingView>
    readonly metrics: InventoryMetrics
    /** Distinct active items that fell to zero in the last 7 days; null when the history could not be read. */
    readonly stockOuts7d: number | null
    readonly nowIso: string
}

/** Says one sentence of the workbench catalog in the reader language, with optional values. */
export type InventorySay = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** The fields of the supplier form, as typed. */
export interface SupplierFormValues {
    readonly name: string
    readonly contactName: string
    readonly email: string
    readonly phone: string
    readonly zalo: string
    readonly channel: string
    readonly leadTime: string
    readonly terms: string
    readonly note: string
}

/** The field names the supplier form changes one at a time. */
export type SupplierFormField = keyof SupplierFormValues
