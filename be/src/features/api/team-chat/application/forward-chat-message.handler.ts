import { CommandHandler } from "@nestjs/cqrs"
import { TeamChatForwardService } from "@modules/domain/team-chat"
import type { MessageView, TeamChatResult } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ForwardChatMessageCommand } from "./forward-chat-message.command"

@CommandHandler(ForwardChatMessageCommand)
/** Forwards a message into another room. The service proves the caller sees the message and sits in the target room. */
export class ForwardChatMessageHandler extends ICQRSHandler<ForwardChatMessageCommand, TeamChatResult<MessageView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly forwards: TeamChatForwardService,
    ) {
        super(logger)
    }

    protected override process(command: ForwardChatMessageCommand): Promise<TeamChatResult<MessageView>> {
        return this.forwards.forward(
            command.params.request.workspaceId,
            command.params.principal.id,
            command.params.request.messageId,
            command.params.request.roomId,
        )
    }
}
