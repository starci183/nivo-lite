import { QueryHandler } from "@nestjs/cqrs"
import { AiUsageOverviewService } from "@modules/domain/ai-usage-events"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { KnowledgeSourceListing } from "./knowledge-sources.contracts"
import { KnowledgeSourcesQuery } from "./knowledge-sources.query"

@QueryHandler(KnowledgeSourcesQuery)
/**
 * Lists the documents of the workspace, newest first and without their text, each with what it cost in AI (read, critique, re-read)
 * for an owner or manager; for staff the cost is null and no usage is read.
 */
export class KnowledgeSourcesHandler extends ICQRSHandler<
    KnowledgeSourcesQuery,
    ReadonlyArray<KnowledgeSourceListing>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly sources: KnowledgeSourcesService,
        private readonly usage: AiUsageOverviewService,
    ) {
        super(logger)
    }

    protected override async process(query: KnowledgeSourcesQuery): Promise<ReadonlyArray<KnowledgeSourceListing>> {
        const { principal, request } = query.params
        const listed = await this.sources.list(principal.id, request.workspaceId, request.module, request.origin)
        const costs = await this.usage.documentCosts(
            principal.id,
            request.workspaceId,
            listed.map((source) => source.id),
        )
        return listed.map((source) => ({ ...source, aiCost: costs?.get(source.id) ?? null }))
    }
}
