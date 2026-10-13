import { QueryHandler } from "@nestjs/cqrs"
import { ContentAiService } from "@modules/domain/content-ai"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetDraftingBlockedQuery } from "./get-drafting-blocked.query"

@QueryHandler(GetDraftingBlockedQuery)
/** Reads the workspace drafting policy. */
export class GetDraftingBlockedHandler extends ICQRSHandler<GetDraftingBlockedQuery, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly contentAi: ContentAiService,
    ) {
        super(logger)
    }

    protected override process(query: GetDraftingBlockedQuery): Promise<boolean> {
        return this.contentAi.draftingBlockedFor(query.params.principal.id, query.params.request.workspaceId)
    }
}
