import { CommandHandler } from "@nestjs/cqrs"
import { AvatarsService } from "@modules/domain/avatars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetAgentAvatarCommand } from "./set-agent-avatar.command"

@CommandHandler(SetAgentAvatarCommand)
/** Sets or removes an agent picture through the avatars service. */
export class SetAgentAvatarHandler extends ICQRSHandler<SetAgentAvatarCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly avatars: AvatarsService,
    ) {
        super(logger)
    }

    protected override process(command: SetAgentAvatarCommand): Promise<void> {
        return this.avatars.setAgentAvatar(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.agentId,
            command.params.request.path,
        )
    }
}
