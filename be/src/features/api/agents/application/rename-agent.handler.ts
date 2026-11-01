import { CommandHandler } from "@nestjs/cqrs"
import { AgentRenameService } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RenameAgentCommand } from "./rename-agent.command"

@CommandHandler(RenameAgentCommand)
/** Renames the agent and queues the sync of its OpenClaw copy. */
export class RenameAgentHandler extends ICQRSHandler<RenameAgentCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly renames: AgentRenameService,
    ) {
        super(logger)
    }

    protected override process(command: RenameAgentCommand): Promise<void> {
        return this.renames.rename(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.name,
        )
    }
}
