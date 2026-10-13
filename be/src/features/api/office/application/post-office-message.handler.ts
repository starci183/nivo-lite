import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/messages"
import type { PostedMessage } from "@modules/domain/messages"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PostOfficeMessageCommand } from "./post-office-message.command"

@CommandHandler(PostOfficeMessageCommand)
/** Posts the line through the team chat service. */
export class PostOfficeMessageHandler extends ICQRSHandler<PostOfficeMessageCommand, PostedMessage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(command: PostOfficeMessageCommand): Promise<PostedMessage> {
        return this.chat.postHuman(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.body,
        )
    }
}
