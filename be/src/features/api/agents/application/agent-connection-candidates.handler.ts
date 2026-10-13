import { QueryHandler } from "@nestjs/cqrs"
import { ConnectionGrantsService } from "@modules/domain/connection-grants"
import type { ConnectionCandidate } from "@modules/domain/connection-grants"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentConnectionCandidatesQuery } from "./agent-connection-candidates.query"

@QueryHandler(AgentConnectionCandidatesQuery)
/** Answers the grantable connections from the grants service. */
export class AgentConnectionCandidatesHandler extends ICQRSHandler<
    AgentConnectionCandidatesQuery,
    ReadonlyArray<ConnectionCandidate>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly grants: ConnectionGrantsService,
    ) {
        super(logger)
    }

    protected override process(query: AgentConnectionCandidatesQuery): Promise<ReadonlyArray<ConnectionCandidate>> {
        return this.grants.candidates(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.agentId,
        )
    }
}
