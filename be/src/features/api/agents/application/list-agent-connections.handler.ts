import { QueryHandler } from "@nestjs/cqrs"
import { AgentBindingsService } from "@modules/domain/agent-connections"
import type { BoundConnection } from "@modules/domain/agent-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentConnectionsQuery } from "./list-agent-connections.query"

@QueryHandler(ListAgentConnectionsQuery)
/** Answers the bindings from the bindings service. */
export class ListAgentConnectionsHandler extends ICQRSHandler<
    ListAgentConnectionsQuery,
    ReadonlyArray<BoundConnection>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bindings: AgentBindingsService,
    ) {
        super(logger)
    }

    protected override process(query: ListAgentConnectionsQuery): Promise<ReadonlyArray<BoundConnection>> {
        return this.bindings.connectionsOfAgent(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.agentId,
        )
    }
}
