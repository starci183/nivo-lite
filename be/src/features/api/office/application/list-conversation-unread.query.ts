import { Query } from "@nestjs/cqrs"
import type { ConversationUnreadListView } from "@modules/domain/office-rooms"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListConversationUnreadRequest } from "./list-conversation-unread.contracts"

/** Asks for the caller's unread counts of the direct conversations. */
export class ListConversationUnreadQuery extends Query<ConversationUnreadListView> {
    constructor(readonly params: ExecuteParams<ListConversationUnreadRequest>) {
        super()
    }
}
