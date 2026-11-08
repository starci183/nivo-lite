import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type MessageView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { UnpinChatMessageCommand } from "./unpin-chat-message.command"

@CommandHandler(UnpinChatMessageCommand)
/** Takes a pin off. The service proves the caller's seat and the room. */
export class UnpinChatMessageHandler extends ICQRSHandler<UnpinChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: UnpinChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        return this.chat.unpin(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.roomId,
            command.params.request.messageId,
        )
    }
}
