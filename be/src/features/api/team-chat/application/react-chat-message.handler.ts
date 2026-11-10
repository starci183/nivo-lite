import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatReactionsService } from "@modules/domain/team-chat"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ReactChatMessageCommand } from "./react-chat-message.command"

@CommandHandler(ReactChatMessageCommand)
/** Adds taps of one emoji to a message. The service proves the caller sits in the room. */
export class ReactChatMessageHandler extends ICQRSHandler<ReactChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly reactions: TeamChatReactionsService,
    ) {
        super(logger)
    }

    protected override process(command: ReactChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        return this.reactions.react(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.messageId,
            command.params.request.emoji,
            command.params.request.times,
        )
    }
}
