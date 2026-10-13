import { QueryHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetContentItemQuery } from "./content-item.query"

@QueryHandler(GetContentItemQuery)
/** Reads a post through the authorized content service. */
export class GetContentItemHandler extends ICQRSHandler<GetContentItemQuery, ContentItem> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }

    protected override process(query: GetContentItemQuery): Promise<ContentItem> {
        return this.content.getForUser(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
