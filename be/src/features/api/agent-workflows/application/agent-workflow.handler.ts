import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import type { WorkflowDetailWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWorkflowQuery } from "./agent-workflow.query"

@QueryHandler(AgentWorkflowQuery)
/** Reads one workflow with the graph that runs, its version history and how it differs from its template. The admin service checks the seat and that the workflow is the agent's. */
export class AgentWorkflowHandler extends ICQRSHandler<AgentWorkflowQuery, WorkflowDetailWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentWorkflowQuery): Promise<WorkflowDetailWire> {
        return this.admin.detail(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
