import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AskKnowledgeQuery } from "./ask-knowledge.query"

@QueryHandler(AskKnowledgeQuery)
/** Answers the passages from the search service. */
export class AskKnowledgeHandler extends ICQRSHandler<AskKnowledgeQuery, ReadonlyArray<Passage>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly search: KnowledgeSearchService,
    ) {
        super(logger)
    }

    protected override process(query: AskKnowledgeQuery): Promise<ReadonlyArray<Passage>> {
        return this.search.ask(query.params.principal.id, query.params.request.workspaceId, query.params.request)
    }
}
