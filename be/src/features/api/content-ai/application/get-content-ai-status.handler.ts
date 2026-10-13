import { QueryHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import type { ContentAiStatus } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentAiStatusQuery } from "./get-content-ai-status.query"

@QueryHandler(GetContentAiStatusQuery)
/** Answers progress without running or applying a generation. */
export class GetContentAiStatusHandler extends ICQRSHandler<GetContentAiStatusQuery, ContentAiStatus> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentAiStatusQuery): Promise<ContentAiStatus> {
        return this.content.status(query.params.principal.id, query.params.request.workspaceId, query.params.request.id)
    }
}
