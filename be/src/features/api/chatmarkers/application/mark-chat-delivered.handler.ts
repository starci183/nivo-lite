import { CommandHandler } from "@nestjs/cqrs"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkChatDeliveredCommand } from "./mark-chat-delivered.command"

@CommandHandler(MarkChatDeliveredCommand)
/** Advances the current member's fetched-message receipt. */
export class MarkChatDeliveredHandler extends ICQRSHandler<MarkChatDeliveredCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly markers: ChatMarkersService,
    ) {
        super(logger)
    }

    protected override process(command: MarkChatDeliveredCommand): Promise<void> {
        return this.markers.markDelivered(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.target,
            command.params.request.messageId,
        )
    }
}
