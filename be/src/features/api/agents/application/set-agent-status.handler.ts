import { CommandHandler } from "@nestjs/cqrs"
import { AgentActivationService } from "@modules/domain/modules"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentStatusCommand } from "./set-agent-status.command"

@CommandHandler(SetAgentStatusCommand)
/** Pauses or resumes the agent through the installation service, so the installation and its agent never disagree. */
export class SetAgentStatusHandler extends ICQRSHandler<SetAgentStatusCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly activation: AgentActivationService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentStatusCommand): Promise<void> {
        return this.activation.setActive(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.active,
        )
    }
}
