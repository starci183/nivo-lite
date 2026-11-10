import { Query } from "@nestjs/cqrs"
import type { WorkflowWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentWorkflowsRequest } from "./agent-workflows.contracts"

/** Lists the workflows of the agent of one installation, the primary one first adopted from its graph. */
export class AgentWorkflowsQuery extends Query<ReadonlyArray<WorkflowWire>> {
    constructor(readonly params: ExecuteParams<AgentWorkflowsRequest>) {
        super()
    }
}
