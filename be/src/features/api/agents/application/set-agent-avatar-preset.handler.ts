import { CommandHandler } from "@nestjs/cqrs"
import { AgentIdentityService } from "@modules/domain/agents"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SetAgentAvatarPresetCommand } from "./set-agent-avatar-preset.command"

@CommandHandler(SetAgentAvatarPresetCommand)
/** Dresses an agent in a preset picture through the agent identity service. */
export class SetAgentAvatarPresetHandler extends ICQRSHandler<SetAgentAvatarPresetCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly identity: AgentIdentityService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentAvatarPresetCommand): Promise<void> {
        return this.identity.setAvatarPreset(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.preset,
        )
    }
}
