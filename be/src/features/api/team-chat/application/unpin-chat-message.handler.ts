import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UnpinChatMessageCommand } from "./unpin-chat-message.command"

@CommandHandler(UnpinChatMessageCommand)
/** Takes a pin off. The service proves the caller's seat and the room. */
export class UnpinChatMessageHandler extends ICQRSHandler<UnpinChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: UnpinChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        const { principal: p, request: r } = command.params
        return this.chat.unpin(r.workspaceId, p.id, r.roomId, r.messageId)
    }
}
