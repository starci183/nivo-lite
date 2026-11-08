import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type UnreadView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ChatUnreadQuery } from "./chat-unread.query"

@QueryHandler(ChatUnreadQuery)
/** Counts what the caller has not read. The service proves the caller's seat and the room. */
export class ChatUnreadHandler extends ICQRSHandler<ChatUnreadQuery, UnreadView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ChatUnreadQuery): Promise<UnreadView> {
        return this.chat.unread(query.params.request.workspaceId, query.params.principal.id)
    }
}
