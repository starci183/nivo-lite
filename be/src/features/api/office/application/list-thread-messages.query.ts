import { Query } from "@nestjs/cqrs"
import type { MessagePage } from "@modules/domain/office-command-candidates"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListThreadMessagesRequest } from "./list-thread-messages.contracts"

/** Asks for one page of the Office thread, newest first. */
export class ListThreadMessagesQuery extends Query<MessagePage> {
    constructor(readonly params: ExecuteParams<ListThreadMessagesRequest>) {
        super()
    }
}
