import { Command } from "@nestjs/cqrs"
import type { AdjustStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AdjustStockRequest } from "./adjust-stock.contracts"

/** Asks to change one item's quantity by hand. */
export class AdjustStockCommand extends Command<AdjustStockOutput> {
    constructor(readonly params: ExecuteParams<AdjustStockRequest>) {
        super()
    }
}
