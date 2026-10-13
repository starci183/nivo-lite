import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceSummary } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSourcesQuery } from "./knowledge-sources.query"

@QueryHandler(KnowledgeSourcesQuery)
/** Lists the documents of the workspace, newest first and without their text. */
export class KnowledgeSourcesHandler extends ICQRSHandler<KnowledgeSourcesQuery, ReadonlyArray<SourceSummary>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeSourcesQuery): Promise<ReadonlyArray<SourceSummary>> {
        return this.sources.list(query.params.principal.id, query.params.request.workspaceId, query.params.request.module)
    }
}
