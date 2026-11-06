import { Query } from "@nestjs/cqrs"
import type { MessagePage } from "@modules/domain/team-chat"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MessagesRequest } from "./team-chat.contracts"

/** Reads one page of a thread. */
export class ChatMessagesQuery extends Query<MessagePage> {
    constructor(readonly params: ExecuteParams<MessagesRequest>) {
        super()
    }
}
