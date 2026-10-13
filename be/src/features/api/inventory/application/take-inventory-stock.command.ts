import { Command } from "@nestjs/cqrs"
import type { StockTakeOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TakeInventoryStockRequest } from "./take-inventory-stock.contracts"

/** Asks for apply a stock count. */
export class TakeInventoryStockCommand extends Command<StockTakeOutput> {
    constructor(readonly params: ExecuteParams<TakeInventoryStockRequest>) {
        super()
    }
}
