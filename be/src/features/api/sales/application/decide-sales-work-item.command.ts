import type { SalesAction, SalesDecisionRequest } from "@modules/domain/sales"
import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"

/** Queues a person's decision on a Sales proposal. */
export class DecideSalesWorkItemCommand extends Command<SalesAction> {
    constructor(readonly params: ExecuteParams<SalesDecisionRequest>) {
        super()
    }
}
