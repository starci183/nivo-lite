import { Command } from "@nestjs/cqrs"
import type { DraftLowStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DraftInventoryLowStockRequest } from "./draft-inventory-low-stock.contracts"

/** Asks for draft purchase orders for the items at or below their reorder point. */
export class DraftInventoryLowStockCommand extends Command<DraftLowStockOutput> {
    constructor(readonly params: ExecuteParams<DraftInventoryLowStockRequest>) {
        super()
    }
}
