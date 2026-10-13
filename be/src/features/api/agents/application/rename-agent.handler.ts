import { CommandHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenameAgentCommand } from "./rename-agent.command"

@CommandHandler(RenameAgentCommand)
/** Renames the agent through the agents service. */
export class RenameAgentHandler extends ICQRSHandler<RenameAgentCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(command: RenameAgentCommand): Promise<void> {
        return this.agents.rename(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.name,
        )
    }
}
