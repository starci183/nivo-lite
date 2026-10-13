import { QueryHandler } from "@nestjs/cqrs"
import { ChatReplyStatusService } from "@modules/domain/chatreply"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatAnswerStatusQuery } from "./chat-answer-status.query"

@QueryHandler(ChatAnswerStatusQuery)
/** Reads the queued escalation decision and its answer delivery. */
export class ChatAnswerStatusHandler extends ICQRSHandler<ChatAnswerStatusQuery, ChatReplyProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: ChatReplyStatusService,
    ) {
        super(logger)
    }

    protected override process(command: ChatAnswerStatusQuery): Promise<ChatReplyProgress> {
        return this.service.answerStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.workItemId,
        )
    }
}
