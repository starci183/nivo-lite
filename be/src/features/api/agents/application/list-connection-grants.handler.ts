import { QueryHandler } from "@nestjs/cqrs"
import { AgentBindingsService, type ConnectionGrant } from "@modules/domain/agent-connections"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListConnectionGrantsQuery } from "./list-connection-grants.query"

@QueryHandler(ListConnectionGrantsQuery)
/** Answers the agents granted each connection from the bindings service. */
export class ListConnectionGrantsHandler extends ICQRSHandler<
    ListConnectionGrantsQuery,
    ReadonlyArray<ConnectionGrant>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly bindings: AgentBindingsService,
    ) {
        super(logger)
    }

    protected override process(query: ListConnectionGrantsQuery): Promise<ReadonlyArray<ConnectionGrant>> {
        return this.bindings.grantsWithAgents(query.params.principal.id, query.params.request.workspaceId)
    }
}
