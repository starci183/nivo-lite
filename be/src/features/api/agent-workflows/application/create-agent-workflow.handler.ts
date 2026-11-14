import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type WorkflowWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { CreateAgentWorkflowCommand } from "./create-agent-workflow.command"

@CommandHandler(CreateAgentWorkflowCommand)
/** Adds a workflow to the agent: a copy of a template version, or a blank one with a name. The admin service checks the seat and that the workflow is the agent's. */
export class CreateAgentWorkflowHandler extends ICQRSHandler<CreateAgentWorkflowCommand, WorkflowWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: CreateAgentWorkflowCommand): Promise<WorkflowWire> {
        return this.admin.create(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
