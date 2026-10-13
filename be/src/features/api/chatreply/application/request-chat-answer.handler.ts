import { CommandHandler } from "@nestjs/cqrs"
import { ChatReplyService } from "@modules/domain/chatreply"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { RequestChatAnswerCommand } from "./request-chat-answer.command"

@CommandHandler(RequestChatAnswerCommand)
/** Queues the decision of a waiting customer escalation. */
export class RequestChatAnswerHandler extends ICQRSHandler<RequestChatAnswerCommand, ChatReplyProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: ChatReplyService,
    ) {
        super(logger)
    }

    protected override process(command: RequestChatAnswerCommand): Promise<ChatReplyProgress> {
        return this.service.requestAnswer(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request,
        )
    }
}
