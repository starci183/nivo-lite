import { Query } from "@nestjs/cqrs"
import type { ConnectionGrant } from "@modules/domain/agent-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListConnectionGrantsRequest } from "./list-connection-grants.contracts"

/** Asks for the agents granted each connection of the workspace. */
export class ListConnectionGrantsQuery extends Query<ReadonlyArray<ConnectionGrant>> {
    constructor(readonly params: ExecuteParams<ListConnectionGrantsRequest>) {
        super()
    }
}
