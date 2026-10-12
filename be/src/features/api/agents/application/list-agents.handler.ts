import { QueryHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import type { AgentSummary } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentsQuery } from "./list-agents.query"

@QueryHandler(ListAgentsQuery)
/** Answers the agents of the workspace from the agents service. */
export class ListAgentsHandler extends ICQRSHandler<ListAgentsQuery, ReadonlyArray<AgentSummary>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(query: ListAgentsQuery): Promise<ReadonlyArray<AgentSummary>> {
        return this.agents.list(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.module,
        )
    }
}
