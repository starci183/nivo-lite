import { QueryHandler } from "@nestjs/cqrs"
import { ThreadFeedService } from "@modules/domain/thread-messages"
import type { ChainView } from "@modules/domain/work-chains"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReadWorkChainQuery } from "./read-work-chain.query"

@QueryHandler(ReadWorkChainQuery)
/** Answers the chain of one thread: its steps and its summary through one domain-service call. */
export class ReadWorkChainHandler extends ICQRSHandler<ReadWorkChainQuery, ChainView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly feed: ThreadFeedService,
    ) {
        super(logger)
    }

    protected override process(query: ReadWorkChainQuery): Promise<ChainView> {
        return this.feed.chain(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.threadId,
        )
    }
}
