import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type MessageView, type TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { SendChatMessageCommand } from "./send-chat-message.command"

@CommandHandler(SendChatMessageCommand)
/** Writes a text message. The service proves the caller's seat and the room. */
export class SendChatMessageHandler extends ICQRSHandler<SendChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(command: SendChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        return this.chat.send(command.params.request.workspaceId, command.params.principal.id, command.params.request)
    }
}
