import { Query } from "@nestjs/cqrs"
import type { AgentGraphRunEntryWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentGraphRunsRequest } from "./list-agent-graph-runs.contracts"

/** Lists what ran against the graph of an agent, newest first: every road, whether a work item was left or not. */
export class ListAgentGraphRunsQuery extends Query<ReadonlyArray<AgentGraphRunEntryWire>> {
    constructor(readonly params: ExecuteParams<ListAgentGraphRunsRequest>) {
        super()
    }
}
