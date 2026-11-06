import { Query } from "@nestjs/cqrs"
import type { ChatRoomView } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RoomRequest } from "./team-chat.contracts"

/** Reads one room the caller may see. */
export class ChatRoomQuery extends Query<ChatRoomView | null> {
    constructor(readonly params: ExecuteParams<RoomRequest>) {
        super()
    }
}
