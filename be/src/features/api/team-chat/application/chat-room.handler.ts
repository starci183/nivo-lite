import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatRoomQuery } from "./chat-room.query"

@QueryHandler(ChatRoomQuery)
/** Reads one room the caller may see. The service proves the caller's seat and the room. */
export class ChatRoomHandler extends ICQRSHandler<ChatRoomQuery, RoomView | null> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(query: ChatRoomQuery): Promise<RoomView | null> {
        const { principal: p, request: r } = query.params
        return this.chat.room(r.workspaceId, p.id, r.roomId)
    }
}
