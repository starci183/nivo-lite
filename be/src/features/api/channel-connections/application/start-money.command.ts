import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartMoneyRequest, StartMoneyResult } from "./start-money.contracts"

/** Starts a bank or payment feed connection. */
export class StartMoneyCommand extends Command<StartMoneyResult> {
    constructor(readonly params: ExecuteParams<StartMoneyRequest>) {
        super()
    }
}
