import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentWorkflowGraphRequest, AgentWorkflowGraphResult } from "./agent-workflow-graph.contracts"

/** The agent Graph page of one installation: every workflow of its agent with its contract, triggers, outcomes and end hand-offs. */
export class AgentWorkflowGraphQuery extends Query<AgentWorkflowGraphResult> {
    constructor(readonly params: ExecuteParams<AgentWorkflowGraphRequest>) {
        super()
    }
}
