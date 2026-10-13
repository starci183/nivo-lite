import { Query } from "@nestjs/cqrs"
import type { ChatReplyProgress } from "@modules/domain/chatreply"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChatReplyStatusRequest } from "./chat-reply-status.contracts"

/** Reads the delivery progress of a stored human reply. */
export class ChatReplyStatusQuery extends Query<ChatReplyProgress> {
    constructor(readonly params: ExecuteParams<ChatReplyStatusRequest>) {
        super()
    }
}
