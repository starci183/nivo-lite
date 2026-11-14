import { QueryHandler } from "@nestjs/cqrs"
import { TeamChatRoomsService, type ChatRoomView } from "@modules/domain/team-chat"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { ChatRoomsQuery } from "./chat-rooms.query"

@QueryHandler(ChatRoomsQuery)
/** Lists the rooms the caller sits in. The service proves the caller's seat and the room. */
export class ChatRoomsHandler extends ICQRSHandler<ChatRoomsQuery, Array<ChatRoomView>> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly chat: TeamChatRoomsService,
    ) {
        super(logger)
    }

    protected override process(query: ChatRoomsQuery): Promise<Array<ChatRoomView>> {
        return this.chat.rooms(
            query.params.request.workspaceId,
            query.params.principal.id,
            query.params.request.kind,
            query.params.request.member,
        )
    }
}
