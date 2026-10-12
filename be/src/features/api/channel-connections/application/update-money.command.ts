import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateMoneyRequest, UpdateMoneyResult } from "./update-money.contracts"

/** Edits a bank or payment feed connection. */
export class UpdateMoneyCommand extends Command<UpdateMoneyResult> {
    constructor(readonly params: ExecuteParams<UpdateMoneyRequest>) {
        super()
    }
}
