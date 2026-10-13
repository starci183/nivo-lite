import { QueryHandler } from "@nestjs/cqrs"
import { ContentEditorService } from "@modules/domain/content-items"
import type { ContentItem } from "@modules/domain/content-items"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListContentItemsQuery } from "./content-items.query"

@QueryHandler(ListContentItemsQuery)
/** Lists posts through the authorized content service. */
export class ListContentItemsHandler extends ICQRSHandler<ListContentItemsQuery, ReadonlyArray<ContentItem>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly content: ContentEditorService,
    ) {
        super(logger)
    }

    protected override process(query: ListContentItemsQuery): Promise<ReadonlyArray<ContentItem>> {
        return this.content.list(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.range,
        )
    }
}
