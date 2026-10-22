import { CommandHandler } from "@nestjs/cqrs"
import { AgentOwnershipService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentOwnershipCommand } from "./set-agent-ownership.command"

@CommandHandler(SetAgentOwnershipCommand)
/** Replaces the ownership of the agent through the agents service. */
export class SetAgentOwnershipHandler extends ICQRSHandler<SetAgentOwnershipCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentOwnershipService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentOwnershipCommand): Promise<void> {
        return this.agents.setOwnership(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request,
        )
    }
}
