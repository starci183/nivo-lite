import { Query } from "@nestjs/cqrs"
import type { ChatMarkerState } from "@modules/domain/chat-markers"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatMarkerRequest } from "./chat-markers.contracts"

/** Requests the caller's mute preference and last authored message receipt. */
export class ChatMarkerStateQuery extends Query<ChatMarkerState> {
    constructor(readonly params: ExecuteParams<ChatMarkerRequest>) {
        super()
    }
}
