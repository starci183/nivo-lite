import { Query } from "@nestjs/cqrs"
import type { ConnectionBoardEntry } from "@modules/domain/connection-grants"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListConnectionsRequest } from "./list-connections.contracts"

/** Asks for every connection of the workspace with the agents that use each. */
export class ListConnectionsQuery extends Query<ReadonlyArray<ConnectionBoardEntry>> {
    constructor(readonly params: ExecuteParams<ListConnectionsRequest>) {
        super()
    }
}
