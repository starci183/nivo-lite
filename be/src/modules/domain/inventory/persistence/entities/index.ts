import { InventoryLocationEntity } from "./inventory-location.entity"
import { InventorySupplierEntity } from "./inventory-supplier.entity"
import { InventoryItemEntity } from "./inventory-item.entity"
import { InventoryStockLevelEntity } from "./inventory-stock-level.entity"
import { InventoryMovementEntity } from "./inventory-movement.entity"
import { InventoryRecipeEntity } from "./inventory-recipe.entity"
import { InventoryRecipeLineEntity } from "./inventory-recipe-line.entity"
import { InventoryPurchaseOrderEntity } from "./inventory-purchase-order.entity"
import { InventoryPoLineEntity } from "./inventory-po-line.entity"
import { InventoryReceiptEntity } from "./inventory-receipt.entity"

export {
    InventoryLocationEntity,
    InventorySupplierEntity,
    InventoryItemEntity,
    InventoryStockLevelEntity,
    InventoryMovementEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryPurchaseOrderEntity,
    InventoryPoLineEntity,
    InventoryReceiptEntity,
}
export type { InventoryItemUnit } from "./inventory-item.entity"
export type { SupplierChannel } from "./inventory-supplier.entity"

/** The entities the inventory capability owns, collected by the database module. */
export const inventoryEntities = [
    InventoryLocationEntity,
    InventorySupplierEntity,
    InventoryItemEntity,
    InventoryStockLevelEntity,
    InventoryMovementEntity,
    InventoryRecipeEntity,
    InventoryRecipeLineEntity,
    InventoryPurchaseOrderEntity,
    InventoryPoLineEntity,
    InventoryReceiptEntity,
] as const
