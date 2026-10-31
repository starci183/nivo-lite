import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ConfirmAgentGraphProposalCommand } from "./confirm-agent-graph-proposal.command"

@CommandHandler(ConfirmAgentGraphProposalCommand)
/** Confirms a learned proposal for the graph of one agent and publishes the change it makes as the next version. The admin service checks the owner or manager role. */
export class ConfirmAgentGraphProposalHandler extends ICQRSHandler<ConfirmAgentGraphProposalCommand, GraphVersionView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: ConfirmAgentGraphProposalCommand): Promise<GraphVersionView> {
        return this.admin.confirm({ workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id }, command.params.request.agentId, command.params.request.proposalId)
    }
}
