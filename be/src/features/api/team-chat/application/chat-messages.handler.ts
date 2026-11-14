import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type MessagePage } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ChatMessagesQuery } from "./chat-messages.query"

@QueryHandler(ChatMessagesQuery)
/** Reads one page of a thread. The service proves the caller's seat and the room. */
export class ChatMessagesHandler extends ICQRSHandler<ChatMessagesQuery, MessagePage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ChatMessagesQuery): Promise<MessagePage> {
        return this.chat.messages(
            query.params.request.workspaceId,
            query.params.principal.id,
            query.params.request.roomId,
            query.params.request.first,
            query.params.request.after,
            query.params.request.pinnedOnly,
        )
    }
}
