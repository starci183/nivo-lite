import { Query } from "@nestjs/cqrs"
import type { ThreadListing } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { Connection } from "@modules/platform/pagination"
import type { ListWorkThreadsRequest } from "./list-work-threads.contracts"

/** Asks for the newest threads of the workspace. */
export class ListWorkThreadsQuery extends Query<Connection<ThreadListing>> {
    constructor(readonly params: ExecuteParams<ListWorkThreadsRequest>) {
        super()
    }
}
