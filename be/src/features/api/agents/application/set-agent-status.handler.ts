import { CommandHandler } from "@nestjs/cqrs"
import { AgentsService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentStatusCommand } from "./set-agent-status.command"

@CommandHandler(SetAgentStatusCommand)
/** Pauses or resumes the agent through the agents service. */
export class SetAgentStatusHandler extends ICQRSHandler<SetAgentStatusCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly agents: AgentsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentStatusCommand): Promise<void> {
        return this.agents.setStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.active,
        )
    }
}
