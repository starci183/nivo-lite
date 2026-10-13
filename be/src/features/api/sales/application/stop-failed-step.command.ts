import { Command } from "@nestjs/cqrs"
import type { WorkItem } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SalesItemRequest } from "@modules/domain/sales"

/** Stops one failed Sales step. */
export class StopFailedStepCommand extends Command<WorkItem> {
    constructor(readonly params: ExecuteParams<SalesItemRequest>) {
        super()
    }
}
