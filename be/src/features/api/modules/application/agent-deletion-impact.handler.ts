import { QueryHandler } from "@nestjs/cqrs"
import { AgentRemovalService, type AgentRemovalImpact } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentDeletionImpactQuery } from "./agent-deletion-impact.query"

@QueryHandler(AgentDeletionImpactQuery)
/** Answers the deletion warning from the removal service: owner or manager only, like the removal. */
export class AgentDeletionImpactHandler extends ICQRSHandler<AgentDeletionImpactQuery, AgentRemovalImpact> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly removal: AgentRemovalService,
    ) {
        super(logger)
    }

    protected override process(query: AgentDeletionImpactQuery): Promise<AgentRemovalImpact> {
        return this.removal.impactOf(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.installationId,
        )
    }
}
