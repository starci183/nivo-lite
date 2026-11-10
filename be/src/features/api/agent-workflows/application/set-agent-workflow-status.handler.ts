import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentWorkflowStatusCommand } from "./set-agent-workflow-status.command"

@CommandHandler(SetAgentWorkflowStatusCommand)
/** Turns a workflow on (active), keeps it as a draft or pauses it. The admin service checks the seat and that the workflow is the agent's. */
export class SetAgentWorkflowStatusHandler extends ICQRSHandler<SetAgentWorkflowStatusCommand, boolean> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentWorkflowStatusCommand): Promise<boolean> {
        return this.admin.setStatus(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
