import type {
    InventoryItemEntity,
    InventoryMovementEntity,
    InventoryPoLineEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryStockLevelEntity,
    InventorySupplierEntity,
} from "../persistence/entities"
import type {
    WorkbenchItemInput,
    WorkbenchLevelInput,
    WorkbenchMovementInput,
    WorkbenchPoLineInput,
    WorkbenchRecipeInput,
    WorkbenchRecipeLineInput,
    WorkbenchSupplierInput,
} from "./inventory-workbench.inputs"
import type { ItemRowColumns } from "./item-row.policy"

/** The most catalogue items one read answers. */
export const ITEM_LIMIT = 2000

/** The purchase-order states that still wait on goods or a decision. */
export const OPEN_PO_STATUSES = ["draft", "waiting_approval", "sent", "partially_received"] as const

/** Maps an item entity to the row shape the item policy reads. */
export const itemRowOf = (item: InventoryItemEntity): ItemRowColumns & WorkbenchItemInput => ({
    id: item.id,
    sku: item.sku,
    name: item.name,
    unit: item.unit,
    units: item.units,
    category: item.category,
    cost_vnd: item.costVnd,
    sell_price_vnd: item.sellPriceVnd,
    reorder_point: item.reorderPoint,
    reorder_qty: item.reorderQty,
    supplier_id: item.supplierId,
    aliases: item.aliases,
    active: item.active,
})

/** Maps a supplier entity to what the workbench policy reads. */
export const supplierInputOf = (supplier: InventorySupplierEntity): WorkbenchSupplierInput => ({
    id: supplier.id,
    name: supplier.name,
    contact_name: supplier.contactName,
    email: supplier.email,
    phone: supplier.phone,
    zalo: supplier.zalo,
    channel: supplier.channel,
    lead_time_days: supplier.leadTimeDays,
    payment_terms: supplier.paymentTerms,
    note: supplier.note,
})

/** Maps a stock level entity to what the workbench policy reads. */
export const levelInputOf = (level: InventoryStockLevelEntity): WorkbenchLevelInput => ({
    item_id: level.itemId,
    location_id: level.locationId,
    qty: level.qty,
})

/** Maps a recipe entity to what the workbench policy reads. */
export const recipeInputOf = (recipe: InventoryRecipeEntity): WorkbenchRecipeInput => ({
    id: recipe.id,
    name: recipe.name,
    aliases: recipe.aliases,
})

/** Maps a recipe line entity to what the workbench policy reads. */
export const recipeLineInputOf = (line: InventoryRecipeLineEntity): WorkbenchRecipeLineInput => ({
    recipe_id: line.recipeId,
    item_id: line.itemId,
    qty: line.qty,
})

/** Maps a purchase order line entity to what the workbench policy reads. */
export const poLineInputOf = (line: InventoryPoLineEntity): WorkbenchPoLineInput => ({
    id: line.id,
    po_id: line.poId,
    item_id: line.itemId,
    qty_ordered: line.qtyOrdered,
    qty_received: line.qtyReceived,
    unit_cost_vnd: line.unitCostVnd,
})

/** Maps a movement entity to what the workbench policy reads. */
export const movementInputOf = (movement: InventoryMovementEntity): WorkbenchMovementInput => ({
    id: movement.id,
    item_id: movement.itemId,
    kind: movement.kind,
    qty: movement.qty,
    qty_after: movement.qtyAfter,
    reason: movement.reason,
    ref_label: movement.refLabel,
    by_name: movement.byName,
    evidence: movement.evidence,
    created_at: movement.createdAt,
})
