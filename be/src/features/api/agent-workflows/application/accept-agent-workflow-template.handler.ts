import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type WorkflowVersionWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AcceptAgentWorkflowTemplateCommand } from "./accept-agent-workflow-template.command"

@CommandHandler(AcceptAgentWorkflowTemplateCommand)
/** Accepts a newer template version into a workflow, written as a new version. The admin service checks the seat and that the workflow is the agent's. */
export class AcceptAgentWorkflowTemplateHandler extends ICQRSHandler<
    AcceptAgentWorkflowTemplateCommand,
    WorkflowVersionWire
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AcceptAgentWorkflowTemplateCommand): Promise<WorkflowVersionWire> {
        return this.admin.acceptTemplate(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
