import { CommandHandler } from "@nestjs/cqrs"
import { AgentIdentityService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenameAgentCommand } from "./rename-agent.command"

@CommandHandler(RenameAgentCommand)
/** Renames the agent through its identity service. */
export class RenameAgentHandler extends ICQRSHandler<RenameAgentCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly identity: AgentIdentityService,
    ) {
        super(logger)
    }

    protected override process(command: RenameAgentCommand): Promise<void> {
        return this.identity.rename(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.name,
        )
    }
}
