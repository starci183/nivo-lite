import { QueryHandler } from "@nestjs/cqrs"
import { KnowledgeSourceReadService, type KnowledgeSourceRead } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KnowledgeSourceQuery } from "./knowledge-source.query"

@QueryHandler(KnowledgeSourceQuery)
/** Reads one document of the workspace with its text and its passages, and what it cost in AI for an owner or manager (null for staff). */
export class KnowledgeSourceHandler extends ICQRSHandler<KnowledgeSourceQuery, KnowledgeSourceRead> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly source: KnowledgeSourceReadService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeSourceQuery): Promise<KnowledgeSourceRead> {
        return this.source.read(query.params.principal.id, query.params.request.workspaceId, query.params.request.id)
    }
}
