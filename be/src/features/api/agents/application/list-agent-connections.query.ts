import { Query } from "@nestjs/cqrs"
import type { BoundConnection } from "@modules/domain/agent-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentConnectionsRequest } from "./list-agent-connections.contracts"

/** Asks for the connections granted to an agent. */
export class ListAgentConnectionsQuery extends Query<ReadonlyArray<BoundConnection>> {
    constructor(readonly params: ExecuteParams<ListAgentConnectionsRequest>) {
        super()
    }
}
