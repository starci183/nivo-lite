import { Query } from "@nestjs/cqrs"
import type { InboundEventFeedRow } from "@modules/domain/inbound-events"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListInboundEventsRequest } from "./list-inbound-events.contracts"

/** Lists the most recent inputs received in the selected workspace. */
export class ListInboundEventsQuery extends Query<ReadonlyArray<InboundEventFeedRow>> {
    constructor(readonly params: ExecuteParams<ListInboundEventsRequest>) {
        super()
    }
}
