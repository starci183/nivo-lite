import { CommandHandler } from "@nestjs/cqrs"
import { AgentWorkflowsAdminService, type AgentRightsAgreed } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgreeAgentNodeRightsCommand } from "./agree-agent-node-rights.command"

@CommandHandler(AgreeAgentNodeRightsCommand)
/** One consent over the running workflows of an agent. The admin service checks the seat; the gate refuses whoever is not the owner. */
export class AgreeAgentNodeRightsHandler extends ICQRSHandler<AgreeAgentNodeRightsCommand, AgentRightsAgreed> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentWorkflowsAdminService,
    ) {
        super(logger)
    }

    protected override process(command: AgreeAgentNodeRightsCommand): Promise<AgentRightsAgreed> {
        return this.admin.agreeRights(
            { workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id },
            command.params.request,
        )
    }
}
