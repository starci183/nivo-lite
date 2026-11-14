import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import type { AgentWorkflowGraphResult } from "./agent-workflow-graph.contracts"
import { AgentWorkflowGraphQuery } from "./agent-workflow-graph.query"

@QueryHandler(AgentWorkflowGraphQuery)
/** The agent Graph page of one installation. The admin service checks the seat and resolves the installation to its agent. */
export class AgentWorkflowGraphHandler extends ICQRSHandler<AgentWorkflowGraphQuery, AgentWorkflowGraphResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentWorkflowGraphQuery): Promise<AgentWorkflowGraphResult> {
        return this.admin.graph(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
