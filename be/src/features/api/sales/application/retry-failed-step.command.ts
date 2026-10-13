import type { SalesAction, SalesItemRequest } from "@modules/domain/sales"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Queues a retry of one failed Sales step. */
export class RetryFailedStepCommand extends Command<SalesAction> {
    constructor(readonly params: ExecuteParams<SalesItemRequest>) {
        super()
    }
}
