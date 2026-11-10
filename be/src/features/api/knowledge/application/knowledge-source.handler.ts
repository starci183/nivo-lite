import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { KnowledgeDocumentsService } from "@modules/domain/knowledge"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { KnowledgeSourceRead } from "./knowledge-source.contracts"
import { KnowledgeSourceQuery } from "./knowledge-source.query"

@QueryHandler(KnowledgeSourceQuery)
/** Reads one document of the workspace with its text and its passages, and what it cost in AI for an owner or manager (null for staff). */
export class KnowledgeSourceHandler extends ICQRSHandler<KnowledgeSourceQuery, KnowledgeSourceRead> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly documents: KnowledgeDocumentsService,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override async process(query: KnowledgeSourceQuery): Promise<KnowledgeSourceRead> {
        const { principal, request } = query.params
        const opened = await this.documents.document(principal.id, request.workspaceId, request.id)
        const costs = await this.usage.documentCosts(principal.id, request.workspaceId, [request.id])
        return { ...opened, aiCost: costs?.get(request.id) ?? null }
    }
}
