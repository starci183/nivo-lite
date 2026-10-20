import { Query } from "@nestjs/cqrs"
import type { GrantView } from "@modules/domain/mcp-gateway"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListMcpToolGrantsRequest } from "./list-mcp-tool-grants.contracts"

/** Asks for every agent's tool grants. */
export class ListMcpToolGrantsQuery extends Query<ReadonlyArray<GrantView>> {
    constructor(readonly params: ExecuteParams<ListMcpToolGrantsRequest>) {
        super()
    }
}
