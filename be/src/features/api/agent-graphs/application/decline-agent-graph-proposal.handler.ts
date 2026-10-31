import { CommandHandler } from "@nestjs/cqrs"
import { AgentGraphAdminService } from "@modules/domain/agent-graphs"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { DeclineAgentGraphProposalCommand } from "./decline-agent-graph-proposal.command"

@CommandHandler(DeclineAgentGraphProposalCommand)
/** Declines a proposal made for the graph of one agent. The admin service checks the owner or manager role. */
export class DeclineAgentGraphProposalHandler extends ICQRSHandler<DeclineAgentGraphProposalCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly admin: AgentGraphAdminService,
    ) {
        super(logger)
    }

    protected override process(command: DeclineAgentGraphProposalCommand): Promise<void> {
        return this.admin.decline({ workspaceId: command.params.request.workspaceId, principalId: command.params.principal.id }, command.params.request.agentId, command.params.request.proposalId)
    }
}
