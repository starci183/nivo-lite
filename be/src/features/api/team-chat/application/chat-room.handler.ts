import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService } from "@modules/domain/team-chat"
import type { ChatRoomView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatRoomQuery } from "./chat-room.query"

@QueryHandler(ChatRoomQuery)
/** Reads one room the caller may see. The service proves the caller's seat and the room. */
export class ChatRoomHandler extends ICQRSHandler<ChatRoomQuery, ChatRoomView | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ChatRoomQuery): Promise<ChatRoomView | null> {
        return this.chat.room(query.params.request.workspaceId, query.params.principal.id, query.params.request.roomId)
    }
}
