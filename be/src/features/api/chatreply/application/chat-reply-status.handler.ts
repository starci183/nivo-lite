import { QueryHandler } from "@nestjs/cqrs"
import { ChatReplyStatusService } from "@modules/domain/chatreply"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatReplyStatusQuery } from "./chat-reply-status.query"

@QueryHandler(ChatReplyStatusQuery)
/** Reads the delivery progress of a stored human reply. */
export class ChatReplyStatusHandler extends ICQRSHandler<ChatReplyStatusQuery, ChatReplyProgress> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly service: ChatReplyStatusService,
    ) {
        super(logger)
    }

    protected override process(command: ChatReplyStatusQuery): Promise<ChatReplyProgress> {
        return this.service.replyStatus(
            command.params.principal.id,
            command.params.request.workspaceId,
            command.params.request.messageId,
        )
    }
}
