import { Command } from "@nestjs/cqrs"
import type { TransferStockOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TransferStockRequest } from "./transfer-stock.contracts"

/** Asks to move goods between two locations. */
export class TransferStockCommand extends Command<TransferStockOutput> {
    constructor(readonly params: ExecuteParams<TransferStockRequest>) {
        super()
    }
}
