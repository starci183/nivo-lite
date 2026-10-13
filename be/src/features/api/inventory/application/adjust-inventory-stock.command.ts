import { Command } from "@nestjs/cqrs"
import type { AdjustStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AdjustInventoryStockRequest } from "./adjust-inventory-stock.contracts"

/** Asks for change one item's quantity by hand. */
export class AdjustInventoryStockCommand extends Command<AdjustStockOutput> {
    constructor(readonly params: ExecuteParams<AdjustInventoryStockRequest>) {
        super()
    }
}
