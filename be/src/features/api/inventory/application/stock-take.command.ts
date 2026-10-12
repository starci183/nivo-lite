import { Command } from "@nestjs/cqrs"
import type { StockTakeOutput } from "@modules/domain/inventory"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StockTakeRequest } from "./stock-take.contracts"

/** Asks to apply a stock count. */
export class StockTakeCommand extends Command<StockTakeOutput> {
    constructor(readonly params: ExecuteParams<StockTakeRequest>) {
        super()
    }
}
