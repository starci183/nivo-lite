import { Module } from "@nestjs/common"
import { AdjustInventoryStockHandler } from "./application/adjust-inventory-stock.handler"
import { ApplyInventoryStarterHandler } from "./application/apply-inventory-starter.handler"
import { CancelInventoryPoHandler } from "./application/cancel-inventory-po.handler"
import { CreateInventoryPoHandler } from "./application/create-inventory-po.handler"
import { DeleteInventoryRecipeHandler } from "./application/delete-inventory-recipe.handler"
import { DraftInventoryLowStockHandler } from "./application/draft-inventory-low-stock.handler"
import { ImportInventoryPasteHandler } from "./application/import-inventory-paste.handler"
import { InventoryTemplatesHandler } from "./application/inventory-templates.handler"
import { InventoryWorkbenchHandler } from "./application/inventory-workbench.handler"
import { ReceiveInventoryPoHandler } from "./application/receive-inventory-po.handler"
import { RequestInventorySendHandler } from "./application/request-inventory-send.handler"
import { SaveInventoryItemHandler } from "./application/save-inventory-item.handler"
import { SaveInventoryLocationHandler } from "./application/save-inventory-location.handler"
import { SaveInventoryRecipeHandler } from "./application/save-inventory-recipe.handler"
import { SaveInventorySupplierHandler } from "./application/save-inventory-supplier.handler"
import { SetInventoryItemActiveHandler } from "./application/set-inventory-item-active.handler"
import { TakeInventoryStockHandler } from "./application/take-inventory-stock.handler"
import { TransferInventoryStockHandler } from "./application/transfer-inventory-stock.handler"
import { UpdateInventoryPoDraftHandler } from "./application/update-inventory-po-draft.handler"
import { ConfigurableModuleClass } from "./inventory.module-definition"

@Module({
    providers: [
        AdjustInventoryStockHandler,
        ApplyInventoryStarterHandler,
        CancelInventoryPoHandler,
        CreateInventoryPoHandler,
        DeleteInventoryRecipeHandler,
        DraftInventoryLowStockHandler,
        ImportInventoryPasteHandler,
        InventoryTemplatesHandler,
        InventoryWorkbenchHandler,
        ReceiveInventoryPoHandler,
        RequestInventorySendHandler,
        SaveInventoryItemHandler,
        SaveInventoryLocationHandler,
        SaveInventoryRecipeHandler,
        SaveInventorySupplierHandler,
        SetInventoryItemActiveHandler,
        TakeInventoryStockHandler,
        TransferInventoryStockHandler,
        UpdateInventoryPoDraftHandler,
    ],
})
/** The inventory feature: the handlers of its application. */
export class InventoryApiModule extends ConfigurableModuleClass {}
