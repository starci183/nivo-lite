import { QueryHandler } from "@nestjs/cqrs"
import { ThreadFeedService } from "@modules/domain/thread-messages"
import type { ThreadView } from "@modules/domain/thread-messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadWorkThreadQuery } from "./read-work-thread.query"

@QueryHandler(ReadWorkThreadQuery)
/** Answers one thread with its newest messages through one domain-service call. */
export class ReadWorkThreadHandler extends ICQRSHandler<ReadWorkThreadQuery, ThreadView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: ThreadFeedService,
    ) {
        super(logger)
    }

    protected override process(query: ReadWorkThreadQuery): Promise<ThreadView> {
        return this.feed.read(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.threadId,
        )
    }
}
