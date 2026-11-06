import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { MessagePage } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatMessagesQuery } from "./chat-messages.query"

@QueryHandler(ChatMessagesQuery)
/** Reads one page of a thread. The service proves the caller's seat and the room. */
export class ChatMessagesHandler extends ICQRSHandler<ChatMessagesQuery, MessagePage> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(query: ChatMessagesQuery): Promise<MessagePage> {
        const { principal: p, request: r } = query.params
        return this.chat.messages(r.workspaceId, p.id, r.roomId, r.first, r.after, r.pinnedOnly)
    }
}
