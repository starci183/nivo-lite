import { QueryHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { AgentGraphRunWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { GetAgentGraphRunQuery } from "./get-agent-graph-run.query"

@QueryHandler(GetAgentGraphRunQuery)
/** Reads the trace of the run of one work item through the graph: the trigger, the branch, the nodes and the version. The admin service checks the owner or manager role. */
export class GetAgentGraphRunHandler extends ICQRSHandler<GetAgentGraphRunQuery, AgentGraphRunWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: GetAgentGraphRunQuery): Promise<AgentGraphRunWire> {
        return this.admin.run(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request.workItemId,
        )
    }
}
