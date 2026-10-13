import { Command } from "@nestjs/cqrs"
import type { TransferStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TransferInventoryStockRequest } from "./transfer-inventory-stock.contracts"

/** Asks for move goods between two locations. */
export class TransferInventoryStockCommand extends Command<TransferStockOutput> {
    constructor(readonly params: ExecuteParams<TransferInventoryStockRequest>) {
        super()
    }
}
