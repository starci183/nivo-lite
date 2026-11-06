import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PinChatMessageCommand } from "./pin-chat-message.command"

@CommandHandler(PinChatMessageCommand)
/** Pins a message. The service proves the caller's seat and the room. */
export class PinChatMessageHandler extends ICQRSHandler<PinChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: PinChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        const { principal: p, request: r } = command.params
        return this.chat.pin(r.workspaceId, p.id, r.roomId, r.messageId)
    }
}
