import { Query } from "@nestjs/cqrs"
import type { AgentGraphRunWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetAgentGraphRunRequest } from "./get-agent-graph-run.contracts"

/** Reads the trace of the run of one work item through the graph: the trigger, the branch, the nodes and the version. */
export class GetAgentGraphRunQuery extends Query<AgentGraphRunWire> {
    constructor(readonly params: ExecuteParams<GetAgentGraphRunRequest>) {
        super()
    }
}
