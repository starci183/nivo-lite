import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type WorkflowVersionWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { PublishAgentWorkflowVersionCommand } from "./publish-agent-workflow-version.command"

@CommandHandler(PublishAgentWorkflowVersionCommand)
/** Publishes a graph as the next version of a workflow. The admin service checks the seat and that the workflow is the agent's. */
export class PublishAgentWorkflowVersionHandler extends ICQRSHandler<
    PublishAgentWorkflowVersionCommand,
    WorkflowVersionWire
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: PublishAgentWorkflowVersionCommand): Promise<WorkflowVersionWire> {
        return this.admin.publish(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
