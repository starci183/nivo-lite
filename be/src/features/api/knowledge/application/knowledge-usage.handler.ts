import { QueryHandler } from "@nestjs/cqrs"
import { SourceQuotaService } from "@modules/domain/knowledge-sources"
import type { KnowledgeUsage } from "@modules/domain/knowledge-sources"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { KnowledgeUsageQuery } from "./knowledge-usage.query"

@QueryHandler(KnowledgeUsageQuery)
/** Answers the raw document bytes the workspace holds and the most it may hold. */
export class KnowledgeUsageHandler extends ICQRSHandler<KnowledgeUsageQuery, KnowledgeUsage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly quota: SourceQuotaService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeUsageQuery): Promise<KnowledgeUsage> {
        return this.quota.usage(query.params.principal.id, query.params.request.workspaceId)
    }
}
