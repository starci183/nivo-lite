import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService, type AgentGraphRunEntryWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ListAgentGraphRunsQuery } from "./list-agent-graph-runs.query"

@QueryHandler(ListAgentGraphRunsQuery)
/** Lists what ran against the graph of an agent, newest first. The admin service checks the owner or manager role. */
export class ListAgentGraphRunsHandler extends ICQRSHandler<
    ListAgentGraphRunsQuery,
    ReadonlyArray<AgentGraphRunEntryWire>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: ListAgentGraphRunsQuery): Promise<ReadonlyArray<AgentGraphRunEntryWire>> {
        return this.admin.runs(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.agentId,
            command.params.request.limit,
        )
    }
}
