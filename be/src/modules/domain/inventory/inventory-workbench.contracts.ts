import type { InventoryItem } from "./inventory.contracts"

/** One stock location of the workbench. */
export interface InventoryLocationView {
    /** The location id. */
    readonly id: string
    /** The location name. */
    readonly name: string
}

/** The stock level of an item at one location. */
export interface InventoryLevelView {
    /** The location. */
    readonly locationId: string
    /** The quantity on hand. */
    readonly qty: number
}

/** Whether an item is out, low, over or fine. */
export type InventoryStockStatus = "out" | "low" | "over" | "ok"

/** One catalogue item with its stock. */
export interface InventoryItemView extends InventoryItem {
    /** The quantity on hand across locations. */
    readonly total: number
    /** The stock state. */
    readonly status: InventoryStockStatus
    /** The quantity open purchase orders still owe. */
    readonly onOrder: number
    /** The level at each location. */
    readonly levels: ReadonlyArray<InventoryLevelView>
}

/** How orders reach a supplier. */
export type InventorySupplierChannel = "email" | "zalo" | "phone"

/** One supplier of the workbench. */
export interface InventorySupplierView {
    /** The supplier id. */
    readonly id: string
    /** The supplier name. */
    readonly name: string
    /** The contact person. */
    readonly contactName: string
    /** The order email address. */
    readonly email: string
    /** The phone number. */
    readonly phone: string
    /** The Zalo contact. */
    readonly zalo: string
    /** How orders reach the supplier. */
    readonly channel: InventorySupplierChannel
    /** The delivery time in days. */
    readonly leadTimeDays: number
    /** The payment terms. */
    readonly paymentTerms: string
    /** A free note. */
    readonly note: string
}

/** One ingredient of a recipe. */
export interface InventoryRecipeLineView {
    /** The ingredient item. */
    readonly itemId: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** The quantity per product. */
    readonly qty: number
}

/** One recipe of the workbench. */
export interface InventoryRecipeView {
    /** The recipe id. */
    readonly id: string
    /** The product name. */
    readonly name: string
    /** Other names. */
    readonly aliases: ReadonlyArray<string>
    /** The ingredients. */
    readonly lines: ReadonlyArray<InventoryRecipeLineView>
}

/** The lifecycle of a purchase order. */
export type InventoryPoStatus = "draft" | "waiting_approval" | "sent" | "partially_received" | "received" | "cancelled"

/** One line of a purchase order. */
export interface InventoryPoLineView {
    /** The line id. */
    readonly id: string
    /** The item. */
    readonly itemId: string
    /** The item name. */
    readonly name: string
    /** The base unit. */
    readonly unit: string
    /** The ordered quantity. */
    readonly qtyOrdered: number
    /** The received quantity. */
    readonly qtyReceived: number
    /** The unit cost. */
    readonly unitCost: number
}

/** One purchase order with its lines. */
export interface InventoryPoView {
    /** The purchase order id. */
    readonly id: string
    /** The order number. */
    readonly poNo: string
    /** The supplier. */
    readonly supplierId: string | null
    /** The supplier name. */
    readonly supplierName: string
    /** The supplier channel. */
    readonly channel: InventorySupplierChannel | null
    /** The status. */
    readonly status: InventoryPoStatus
    /** The order value. */
    readonly totalVnd: number
    /** The expected date. */
    readonly expectedAt: string | null
    /** The order message. */
    readonly message: string
    /** How the order went out. */
    readonly sentVia: "email" | "copy" | null
    /** Why it was not sent. */
    readonly sendNote: string | null
    /** The send decision. */
    readonly workItemId: string | null
    /** How many reminders went out. */
    readonly reminders: number
    /** Who raised it. */
    readonly source: "auto" | "manual"
    /** When it was raised. */
    readonly createdAt: string
    /** The lines. */
    readonly lines: ReadonlyArray<InventoryPoLineView>
}

/** One stock movement of the history. */
export interface InventoryMovementView {
    /** The movement id. */
    readonly id: string
    /** The item name. */
    readonly itemName: string
    /** The base unit. */
    readonly unit: string
    /** The kind. */
    readonly kind: string
    /** The signed change. */
    readonly qty: number
    /** The level after. */
    readonly qtyAfter: number
    /** Why it moved. */
    readonly reason: string
    /** The reference label. */
    readonly refLabel: string
    /** Who moved it. */
    readonly byName: string
    /** The evidence link. */
    readonly evidence: string
    /** When it moved. */
    readonly createdAt: string
}

/** A decision of the inventory department waiting on the owner. */
export interface InventoryPendingView {
    /** The decision id. */
    readonly id: string
    /** The action it decides. */
    readonly action: string
    /** One line saying what it asks. */
    readonly summary: string
    /** The drafted message. */
    readonly draft: string | null
    /** The purchase order it is about, when it is one. */
    readonly poId: string | null
    /** When it was asked. */
    readonly createdAt: string
}

/** The figures of the workbench ribbon. */
export interface InventoryMetricsView {
    /** The stock value in dong. */
    readonly valueVnd: number
    /** Active items. */
    readonly itemCount: number
    /** Items at or below the reorder point. */
    readonly lowCount: number
    /** Items out of stock. */
    readonly outCount: number
    /** Purchase orders still open. */
    readonly openPos: number
    /** Decisions waiting. */
    readonly pendingCount: number
}

/** The whole inventory workbench of a workspace. */
export interface InventoryWorkbenchView {
    /** Whether the caller may change things. */
    readonly canManage: boolean
    /** The default location, when one exists. */
    readonly defaultLocationId: string | null
    /** The stock locations. */
    readonly locations: ReadonlyArray<InventoryLocationView>
    /** The suppliers. */
    readonly suppliers: ReadonlyArray<InventorySupplierView>
    /** The items with their stock. */
    readonly items: ReadonlyArray<InventoryItemView>
    /** The recipes. */
    readonly recipes: ReadonlyArray<InventoryRecipeView>
    /** The purchase orders. */
    readonly pos: ReadonlyArray<InventoryPoView>
    /** The recent movements. */
    readonly movements: ReadonlyArray<InventoryMovementView>
    /** The decisions waiting on the owner. */
    readonly pending: ReadonlyArray<InventoryPendingView>
    /** The ribbon figures. */
    readonly metrics: InventoryMetricsView
    /** Items that stocked out in the last 7 days; null when the history could not be read. */
    readonly stockOuts7d: number | null
    /** When the read ran. */
    readonly nowIso: string
}

/** The caller facts the workbench shape needs. */
export interface InventoryWorkbenchContext {
    /** Whether the caller may write. */
    readonly canManage: boolean
    /** When the read ran. */
    readonly nowIso: string
    /** The default location send orders arrive at, when one is set. */
    readonly defaultLocationId: string | null
}

/** A starter set a business can pick: key, name and what it brings. */
export interface InventoryTemplateInfo {
    /** The template key. */
    readonly key: string
    /** The template name. */
    readonly name: string
    /** What it brings. */
    readonly description: string
}
