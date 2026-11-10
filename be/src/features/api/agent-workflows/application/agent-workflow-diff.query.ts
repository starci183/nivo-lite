import { Query } from "@nestjs/cqrs"
import type { WorkflowDiffWire } from "@modules/domain/agent-graphs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AgentWorkflowDiffRequest } from "./agent-workflow-diff.contracts"

/** Diffs one version of a workflow against the one before it, another version or a template version. */
export class AgentWorkflowDiffQuery extends Query<WorkflowDiffWire> {
    constructor(readonly params: ExecuteParams<AgentWorkflowDiffRequest>) {
        super()
    }
}
