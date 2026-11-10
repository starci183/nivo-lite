import { QueryHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import type { WorkflowWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWorkflowsQuery } from "./agent-workflows.query"

@QueryHandler(AgentWorkflowsQuery)
/** Lists the workflows of the agent of one installation, the primary one first adopted from its graph. The admin service checks the seat and that the workflow is the agent's. */
export class AgentWorkflowsHandler extends ICQRSHandler<AgentWorkflowsQuery, ReadonlyArray<WorkflowWire>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgentWorkflowsQuery): Promise<ReadonlyArray<WorkflowWire>> {
        return this.admin.list(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
