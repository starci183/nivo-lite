import { QueryHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetRecentTitlesQuery } from "./get-recent-titles.query"

@QueryHandler(GetRecentTitlesQuery)
/** Reads titles within the caller's selected workspace. */
export class GetRecentTitlesHandler extends ICQRSHandler<GetRecentTitlesQuery, ReadonlyArray<string>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contentAi: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(query: GetRecentTitlesQuery): Promise<ReadonlyArray<string>> {
        return this.contentAi.recentTitlesFor(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
