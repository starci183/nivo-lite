import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeDocumentsService } from "@modules/domain/knowledge"
import type { OpenedKnowledgeSource } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeSourceQuery } from "./knowledge-source.query"

@QueryHandler(KnowledgeSourceQuery)
/** Reads one document of the workspace with its text and its passages. */
export class KnowledgeSourceHandler extends ICQRSHandler<KnowledgeSourceQuery, OpenedKnowledgeSource> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: KnowledgeDocumentsService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeSourceQuery): Promise<OpenedKnowledgeSource> {
        return this.documents.document(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
