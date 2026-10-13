import type { SalesAction, SalesItemRequest } from "@modules/domain/sales"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Queues a Sales handoff to Accounting. */
export class HandoffToAccountingCommand extends Command<SalesAction> {
    constructor(readonly params: ExecuteParams<SalesItemRequest>) {
        super()
    }
}
