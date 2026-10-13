import { CommandHandler } from "@nestjs/cqrs"
import { ChatReplyService } from "@modules/domain/chatreply"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestChatReplyCommand } from "./request-chat-reply.command"

@CommandHandler(RequestChatReplyCommand)
/** Stores a member reply and queues its delivery. */
export class RequestChatReplyHandler extends ICQRSHandler<RequestChatReplyCommand, ChatReplyProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: ChatReplyService,
    ) {
        super(logger)
    }

    protected override process(command: RequestChatReplyCommand): Promise<ChatReplyProgress> {
        return this.service.requestReply(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
