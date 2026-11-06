import { Query } from "@nestjs/cqrs"
import type { ChatRoomView } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RoomsRequest } from "./team-chat.contracts"

/** Lists the rooms the caller sits in. */
export class ChatRoomsQuery extends Query<Array<ChatRoomView>> {
    constructor(readonly params: ExecuteParams<RoomsRequest>) {
        super()
    }
}
