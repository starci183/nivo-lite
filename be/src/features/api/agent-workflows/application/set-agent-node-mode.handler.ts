import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type WorkflowVersionWire } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetAgentNodeModeCommand } from "./set-agent-node-mode.command"

@CommandHandler(SetAgentNodeModeCommand)
/**
 * Sets one node of a workflow to `auto` or `ask` for the owner (nivo-frame `rights` rule 5: the shop's own graph copy). The admin service
 * checks the seat (owner only), that the workflow is the agent's, and writes the new version through the publish road.
 */
export class SetAgentNodeModeHandler extends ICQRSHandler<SetAgentNodeModeCommand, WorkflowVersionWire> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentNodeModeCommand): Promise<WorkflowVersionWire> {
        const { request, principal } = command.params
        return this.admin.setNodeMode({ workspaceId: request.workspaceId, principalId: principal.id }, request)
    }
}
