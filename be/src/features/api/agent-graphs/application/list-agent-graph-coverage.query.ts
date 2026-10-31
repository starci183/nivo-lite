import { Query } from "@nestjs/cqrs"
import type { AskCoverage } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListAgentGraphCoverageRequest } from "./list-agent-graph-coverage.contracts"

/** Lists who can answer each ask of the graph of one agent, and who was left out and why. */
export class ListAgentGraphCoverageQuery extends Query<ReadonlyArray<AskCoverage>> {
    constructor(readonly params: ExecuteParams<ListAgentGraphCoverageRequest>) {
        super()
    }
}
