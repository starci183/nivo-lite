import { Module } from "@nestjs/common"
import { SaveItemHandler } from "./application/save-item.handler"
import { SetItemActiveHandler } from "./application/set-item-active.handler"
import { SaveSupplierHandler } from "./application/save-supplier.handler"
import { SaveRecipeHandler } from "./application/save-recipe.handler"
import { DeleteRecipeHandler } from "./application/delete-recipe.handler"
import { SaveLocationHandler } from "./application/save-location.handler"
import { ImportPasteHandler } from "./application/import-paste.handler"
import { ApplyStarterHandler } from "./application/apply-starter.handler"
import { DeductOrderHandler } from "./application/deduct-order.handler"
import { AdjustStockHandler } from "./application/adjust-stock.handler"
import { StockTakeHandler } from "./application/stock-take.handler"
import { TransferStockHandler } from "./application/transfer-stock.handler"
import { DraftLowStockHandler } from "./application/draft-low-stock.handler"
import { CreatePoHandler } from "./application/create-po.handler"
import { UpdatePoDraftHandler } from "./application/update-po-draft.handler"
import { RequestSendHandler } from "./application/request-send.handler"
import { CancelPoHandler } from "./application/cancel-po.handler"
import { ReceivePoHandler } from "./application/receive-po.handler"

@Module({
    providers: [
        SaveItemHandler,
        SetItemActiveHandler,
        SaveSupplierHandler,
        SaveRecipeHandler,
        DeleteRecipeHandler,
        SaveLocationHandler,
        ImportPasteHandler,
        ApplyStarterHandler,
        DeductOrderHandler,
        AdjustStockHandler,
        StockTakeHandler,
        TransferStockHandler,
        DraftLowStockHandler,
        CreatePoHandler,
        UpdatePoDraftHandler,
        RequestSendHandler,
        CancelPoHandler,
        ReceivePoHandler,
    ],
})
/** The inventory feature: the handlers of its application. */
export class InventoryApiModule {}
