import { Query } from "@nestjs/cqrs"
import type { ScheduledItem } from "@modules/domain/agent-doors"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadScheduledItemsRequest } from "./schedules.contracts"

/** What the agents of a workspace have scheduled, soonest first. */
export class ReadScheduledItemsQuery extends Query<ReadonlyArray<ScheduledItem>> {
    constructor(readonly params: ExecuteParams<ReadScheduledItemsRequest>) {
        super()
    }
}
