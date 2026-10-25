import { CommandHandler } from "@nestjs/cqrs"
import { AvatarsService } from "@modules/domain/avatars"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetMyAvatarCommand } from "./set-my-avatar.command"

@CommandHandler(SetMyAvatarCommand)
/** Sets or removes the caller's own picture through the avatars service. */
export class SetMyAvatarHandler extends ICQRSHandler<SetMyAvatarCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly avatars: AvatarsService,
    ) {
        super(logger)
    }

    protected override process(command: SetMyAvatarCommand): Promise<void> {
        return this.avatars.setPersonAvatar(command.params.principal.id, command.params.request.path)
    }
}
