import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SendChatMessageCommand } from "./send-chat-message.command"

@CommandHandler(SendChatMessageCommand)
/** Writes a text message. The service proves the caller's seat and the room. */
export class SendChatMessageHandler extends ICQRSHandler<SendChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: SendChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        const { principal: p, request: r } = command.params
        return this.chat.send(r.workspaceId, p.id, r)
    }
}
