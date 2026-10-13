import { QueryHandler } from "@nestjs/cqrs"
import { InboxFeedService } from "@modules/domain/inbound-events"
import type { InboundEventFeedRow } from "@modules/domain/inbound-events"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListInboundEventsQuery } from "./list-inbound-events.query"

@QueryHandler(ListInboundEventsQuery)
/** Proves workspace access before reading its inbound feed. */
export class ListInboundEventsHandler extends ICQRSHandler<ListInboundEventsQuery, ReadonlyArray<InboundEventFeedRow>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: InboxFeedService,
    ) {
        super(logger)
    }

    protected override process(query: ListInboundEventsQuery): Promise<ReadonlyArray<InboundEventFeedRow>> {
        return this.feed.list(query.params.principal.id, query.params.request.workspaceId, query.params.request.limit)
    }
}
