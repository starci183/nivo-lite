import { Query } from "@nestjs/cqrs"
import type { WorkflowDetailWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentWorkflowRequest } from "./agent-workflow.contracts"

/** Reads one workflow with the graph that runs, its version history and how it differs from its template. */
export class AgentWorkflowQuery extends Query<WorkflowDetailWire> {
    constructor(readonly params: ExecuteParams<AgentWorkflowRequest>) {
        super()
    }
}
