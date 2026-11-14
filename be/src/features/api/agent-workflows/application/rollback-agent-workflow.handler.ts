import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type WorkflowVersionWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { RollbackAgentWorkflowCommand } from "./rollback-agent-workflow.command"

@CommandHandler(RollbackAgentWorkflowCommand)
/** Rolls a workflow back to an older version, written as a new version. The admin service checks the seat and that the workflow is the agent's. */
export class RollbackAgentWorkflowHandler extends ICQRSHandler<RollbackAgentWorkflowCommand, WorkflowVersionWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: RollbackAgentWorkflowCommand): Promise<WorkflowVersionWire> {
        return this.admin.rollback(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
