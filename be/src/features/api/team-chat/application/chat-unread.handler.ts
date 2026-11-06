import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { UnreadView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatUnreadQuery } from "./chat-unread.query"

@QueryHandler(ChatUnreadQuery)
/** Counts what the caller has not read. The service proves the caller's seat and the room. */
export class ChatUnreadHandler extends ICQRSHandler<ChatUnreadQuery, UnreadView> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(query: ChatUnreadQuery): Promise<UnreadView> {
        const { principal: p, request: r } = query.params
        return this.chat.unread(r.workspaceId, p.id)
    }
}
