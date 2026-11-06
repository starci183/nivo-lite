import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatService } from "@modules/domain/team-chat"
import type { RoomView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ChatRoomsQuery } from "./chat-rooms.query"

@QueryHandler(ChatRoomsQuery)
/** Lists the rooms the caller sits in. The service proves the caller's seat and the room. */
export class ChatRoomsHandler extends ICQRSHandler<ChatRoomsQuery, Array<RoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatService,
    ) {
        super(logger)
    }

    protected override process(query: ChatRoomsQuery): Promise<Array<RoomView>> {
        const { principal: p, request: r } = query.params
        return this.chat.rooms(r.workspaceId, p.id, r.kind, r.member)
    }
}
