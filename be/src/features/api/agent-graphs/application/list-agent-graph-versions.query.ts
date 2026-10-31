import { Query } from "@nestjs/cqrs"
import type { GraphVersionView } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentGraphVersionsRequest } from "./list-agent-graph-versions.contracts"

/** Lists the versions of the graph of one agent, newest first. */
export class ListAgentGraphVersionsQuery extends Query<ReadonlyArray<GraphVersionView>> {
    constructor(readonly params: ExecuteParams<ListAgentGraphVersionsRequest>) {
        super()
    }
}
