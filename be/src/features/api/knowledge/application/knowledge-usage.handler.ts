import { QueryHandler } from "@nestjs/cqrs"
import { TruthCeilingService, type KnowledgeUsageView } from "@modules/domain/brain"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { KnowledgeUsageQuery } from "./knowledge-usage.query"

@QueryHandler(KnowledgeUsageQuery)
/** Answers what the workspace holds of its raw document allowance, and its truths in force against their ceiling. */
export class KnowledgeUsageHandler extends ICQRSHandler<KnowledgeUsageQuery, KnowledgeUsageView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly ceiling: TruthCeilingService,
    ) {
        super(logger)
    }

    protected override process(query: KnowledgeUsageQuery): Promise<KnowledgeUsageView> {
        return this.ceiling.usageOf(query.params.principal.id, query.params.request.workspaceId)
    }
}
