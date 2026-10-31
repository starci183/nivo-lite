import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ListAgentGraphVersionsQuery } from "./list-agent-graph-versions.query"

@QueryHandler(ListAgentGraphVersionsQuery)
/** Lists the versions of the graph of one agent, newest first. The admin service checks the owner or manager role. */
export class ListAgentGraphVersionsHandler extends ICQRSHandler<
    ListAgentGraphVersionsQuery,
    ReadonlyArray<GraphVersionView>
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: ListAgentGraphVersionsQuery): Promise<ReadonlyArray<GraphVersionView>> {
        return this.admin.versions(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.agentId,
        )
    }
}
