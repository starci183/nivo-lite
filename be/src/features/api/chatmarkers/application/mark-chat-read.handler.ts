import { CommandHandler } from "@nestjs/cqrs"
import { ChatMarkersService } from "@modules/domain/chat-markers"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MarkChatReadCommand } from "./mark-chat-read.command"

@CommandHandler(MarkChatReadCommand)
/** Advances the current member's visibly read-message receipt. */
export class MarkChatReadHandler extends ICQRSHandler<MarkChatReadCommand, void> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly markers: ChatMarkersService,
    ) {
        super(logger)
    }

    protected override process(command: MarkChatReadCommand): Promise<void> {
        return this.markers.markRead(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.target,
            command.params.request.messageId,
        )
    }
}
