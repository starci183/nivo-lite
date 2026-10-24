import { QueryHandler } from "@nestjs/cqrs"
import { ThreadFeedService } from "@modules/domain/thread-messages"
import type { ThreadListing } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { Connection } from "@modules/platform/pagination"
import { ListWorkThreadsQuery } from "./list-work-threads.query"

@QueryHandler(ListWorkThreadsQuery)
/** Answers the newest threads of the workspace through one domain-service call. */
export class ListWorkThreadsHandler extends ICQRSHandler<ListWorkThreadsQuery, Connection<ThreadListing>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: ThreadFeedService,
    ) {
        super(logger)
    }

    protected override process(query: ListWorkThreadsQuery): Promise<Connection<ThreadListing>> {
        return this.feed.list(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.leadId,
            query.params.request,
        )
    }
}
