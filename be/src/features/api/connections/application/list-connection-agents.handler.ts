import { QueryHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { AgentSummary } from "@modules/domain/agents"
import { ListConnectionAgentsQuery } from "./list-connection-agents.query"

@QueryHandler(ListConnectionAgentsQuery)
/** Asks for the agents a connection can be attached to through the AgentsService. */
export class ListConnectionAgentsHandler extends ICQRSHandler<ListConnectionAgentsQuery, ReadonlyArray<AgentSummary>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(query: ListConnectionAgentsQuery): Promise<ReadonlyArray<AgentSummary>> {
        return this.agents.list(query.params.principal.id, query.params.request.workspaceId)
    }
}
