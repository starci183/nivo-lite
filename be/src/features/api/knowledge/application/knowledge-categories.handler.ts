import { QueryHandler } from "@nestjs/cqrs"
import { SourceCategoriesService } from "@modules/domain/knowledge-sources"
import type { SourceCategory } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeCategoriesQuery } from "./knowledge-categories.query"

@QueryHandler(KnowledgeCategoriesQuery)
/** Answers how many documents and raw bytes each category of the workspace holds. */
export class KnowledgeCategoriesHandler extends ICQRSHandler<KnowledgeCategoriesQuery, ReadonlyArray<SourceCategory>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly categories: SourceCategoriesService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeCategoriesQuery): Promise<ReadonlyArray<SourceCategory>> {
        return this.categories.categories(query.params.principal.id, query.params.request.workspaceId)
    }
}
