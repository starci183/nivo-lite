import { CommandHandler } from "@nestjs/cqrs"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SetChatMutedCommand } from "./set-chat-muted.command"

@CommandHandler(SetChatMutedCommand)
/** Writes the current member's preference without changing receipts. */
export class SetChatMutedHandler extends ICQRSHandler<SetChatMutedCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly markers: ChatMarkersService,
    ) {
        super(logger)
    }

    protected override process(command: SetChatMutedCommand): Promise<void> {
        return this.markers.mute(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.target,
            command.params.request.muted,
        )
    }
}
