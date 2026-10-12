import { Command } from "@nestjs/cqrs"
import type { DraftLowStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DraftLowStockRequest } from "./draft-low-stock.contracts"

/** Asks to draft purchase orders for low items. */
export class DraftLowStockCommand extends Command<DraftLowStockOutput> {
    constructor(readonly params: ExecuteParams<DraftLowStockRequest>) {
        super()
    }
}
