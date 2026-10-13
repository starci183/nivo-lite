import { Module } from "@nestjs/common"
import { InventoryApiModule } from "../../inventory.module"
import { AdjustInventoryStockResolver } from "./adjust-inventory-stock.resolver"
import { ApplyInventoryStarterResolver } from "./apply-inventory-starter.resolver"
import { CancelInventoryPoResolver } from "./cancel-inventory-po.resolver"
import { CreateInventoryPoResolver } from "./create-inventory-po.resolver"
import { DeleteInventoryRecipeResolver } from "./delete-inventory-recipe.resolver"
import { DraftInventoryLowStockResolver } from "./draft-inventory-low-stock.resolver"
import { ImportInventoryPasteResolver } from "./import-inventory-paste.resolver"
import { InventoryTemplatesResolver } from "./inventory-templates.resolver"
import { InventoryWorkbenchResolver } from "./inventory-workbench.resolver"
import { ReceiveInventoryPoResolver } from "./receive-inventory-po.resolver"
import { RequestInventorySendResolver } from "./request-inventory-send.resolver"
import { SaveInventoryItemResolver } from "./save-inventory-item.resolver"
import { SaveInventoryLocationResolver } from "./save-inventory-location.resolver"
import { SaveInventoryRecipeResolver } from "./save-inventory-recipe.resolver"
import { SaveInventorySupplierResolver } from "./save-inventory-supplier.resolver"
import { SetInventoryItemActiveResolver } from "./set-inventory-item-active.resolver"
import { TakeInventoryStockResolver } from "./take-inventory-stock.resolver"
import { TransferInventoryStockResolver } from "./transfer-inventory-stock.resolver"
import { UpdateInventoryPoDraftResolver } from "./update-inventory-po-draft.resolver"

@Module({
    imports: [InventoryApiModule],
    providers: [
        AdjustInventoryStockResolver,
        ApplyInventoryStarterResolver,
        CancelInventoryPoResolver,
        CreateInventoryPoResolver,
        DeleteInventoryRecipeResolver,
        DraftInventoryLowStockResolver,
        ImportInventoryPasteResolver,
        InventoryTemplatesResolver,
        InventoryWorkbenchResolver,
        ReceiveInventoryPoResolver,
        RequestInventorySendResolver,
        SaveInventoryItemResolver,
        SaveInventoryLocationResolver,
        SaveInventoryRecipeResolver,
        SaveInventorySupplierResolver,
        SetInventoryItemActiveResolver,
        TakeInventoryStockResolver,
        TransferInventoryStockResolver,
        UpdateInventoryPoDraftResolver,
    ],
})
/** The GraphQL transport of the inventory feature. */
export class InventoryGraphqlModule {}
