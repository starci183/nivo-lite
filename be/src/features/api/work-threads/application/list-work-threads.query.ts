import { Query } from "@nestjs/cqrs"
import type { ThreadListing } from "@modules/domain/thread-messages"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListWorkThreadsRequest } from "./list-work-threads.contracts"

/** Asks for the newest threads of the workspace. */
export class ListWorkThreadsQuery extends Query<ReadonlyArray<ThreadListing>> {
    constructor(readonly params: ExecuteParams<ListWorkThreadsRequest>) {
        super()
    }
}
